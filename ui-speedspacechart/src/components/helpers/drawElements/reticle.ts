import {
  clearCanvas,
  findPreviousAndNextPosition,
  getAdaptiveHeight,
  maxPositionValues,
  speedRangeValues,
} from '../../utils';
import { MARGINS } from '../../const';
import type { DrawFunctionParams } from '../../../types/chartTypes';

const {
  MARGIN_LEFT,
  MARGIN_RIGHT,
  MARGIN_TOP,
  MARGIN_BOTTOM,
  CURVE_MARGIN_TOP,
  CURVE_MARGIN_SIDES,
} = MARGINS;

const RETICLE_LINE = 12.75;

export const drawCursor = ({ ctx, width, height, store }: DrawFunctionParams) => {
  clearCanvas(ctx, width, height);

  const {
    cursor,
    layersDisplay,
    ratioX,
    leftOffset,
    speeds,
    ecoSpeeds,
    stops,
    electrifications,
    slopes,
    electricalProfiles,
    powerRestrictions,
  } = store;

  ctx.strokeStyle = 'rgb(0, 0, 0)';
  ctx.lineWidth = 1;
  ctx.font = 'normal 12px IBM Plex Sans';
  ctx.fillStyle = 'rgb(0,0,0)';
  ctx.shadowOffsetY = 0;
  ctx.shadowBlur = 0;

  let speedText = '';
  let ecoSpeedText = '';
  let effortText = 'coasting';
  let electricalModeText = '';
  let electricalProfileText = '';
  let powerRestrictionText = '';
  let previousGradientText = 0;
  let modeText = '';
  let curveX = cursor.x!;
  let curveY = 0;
  let x = {
    a: 0,
    b: 0,
  };
  let y = {
    a: 0,
    b: 0,
  };

  const { minSpeed, speedRange } = speedRangeValues(store);
  const { maxPosition } = maxPositionValues(store);

  const heightWithoutLayers = getAdaptiveHeight(height, layersDisplay, false);
  const cursorBoxHeight = heightWithoutLayers - MARGIN_BOTTOM - MARGIN_TOP;
  const cursorBoxWidth = width - MARGIN_LEFT - MARGIN_RIGHT;

  const xPositionReference = (ref: number) =>
    ref * ((cursorBoxWidth - CURVE_MARGIN_SIDES) / maxPosition) * ratioX +
    leftOffset +
    CURVE_MARGIN_SIDES / 2;

  if (cursor.x && cursor.y) {
    // get the nearest previous and next speed values of the curve based on pointer position
    const { previousPosition: previousCurvePosition, nextPosition: nextCurvePosition } =
      findPreviousAndNextPosition(speeds, cursor.x!, xPositionReference);

    // get the nearest previous and next speed values of the curve based on pointer position
    const { previousPosition: previousEcoCurvePosition, nextPosition: nextEcoCurvePosition } =
      findPreviousAndNextPosition(ecoSpeeds, cursor.x!, xPositionReference);

    // get the nearest previous and next stop values of the curve based on pointer position
    const { previousPosition: previousStop, nextPosition: nextStop } = findPreviousAndNextPosition(
      stops,
      cursor.x!,
      xPositionReference
    );

    // Get the electrical profile name based on the position of the cursor
    if (electricalProfiles) {
      const electricalProfileValue = electricalProfiles.find(
        ({ position }) =>
          xPositionReference(position.start) <= cursor.x! &&
          xPositionReference(position.end!) >= cursor.x!
      )?.value.electricalProfile;

      if (electricalProfileValue) {
        electricalProfileText = electricalProfileValue;
      }
    }

    // Get the power restriction code based on the position of the cursor
    if (powerRestrictions) {
      const currentPowerRestriction = powerRestrictions.find(
        ({ position }) =>
          cursor.x! >= xPositionReference(position.start) &&
          cursor.x! <= xPositionReference(position.end!)
      );
      powerRestrictionText = currentPowerRestriction?.value.powerRestriction || '';
    }

    // calculate the y position of the curve based on pointer position between two points
    // adapt texts based on the position of the cursor
    if (
      previousCurvePosition !== undefined &&
      nextCurvePosition !== undefined &&
      previousStop !== undefined &&
      nextStop !== undefined
    ) {
      const normalizedPreviousSpeed = (previousCurvePosition.value - minSpeed) / speedRange;
      const normalizedNextSpeed = (nextCurvePosition.value - minSpeed) / speedRange;
      x = {
        a: xPositionReference(previousCurvePosition.position.start),
        b: xPositionReference(nextCurvePosition.position.start),
      };
      y = {
        a: cursorBoxHeight - normalizedPreviousSpeed * (cursorBoxHeight - CURVE_MARGIN_TOP),
        b: cursorBoxHeight - normalizedNextSpeed * (cursorBoxHeight - CURVE_MARGIN_TOP),
      };

      const previousElectrification = electrifications.findLast(
        ({ position }) => position.start <= previousCurvePosition.position.start
      );

      const electrificationUsage = previousElectrification?.value;
      if (electrificationUsage) {
        const isElectrified = electrificationUsage.type === 'electrification';
        modeText = isElectrified ? 'electric' : '--';
        electricalModeText = electrificationUsage.voltage!;
      }

      // find out if the cursor isn't close to the previous stop or the next stop based on 20px
      if (
        curveX - xPositionReference(previousStop.position.start) > 20 &&
        xPositionReference(nextStop.position.start) - curveX > 20
      ) {
        const drop = (y.b! - y.a!) / (x.b! - x.a!);
        const deltaX = curveX - x.a;
        const deltaY = drop * deltaX;
        curveY = y.a! + deltaY;

        speedText = (
          previousCurvePosition.value +
            ((nextCurvePosition.value - previousCurvePosition.value) * (curveX - x.a)) /
              (x.b - x.a) || 0
        ).toFixed(1);

        ecoSpeedText = (
          previousEcoCurvePosition!.value +
            ((nextEcoCurvePosition!.value - previousEcoCurvePosition!.value) * (curveX - x.a)) /
              (x.b - x.a) || 0
        ).toFixed(1);

        if (previousCurvePosition.value < nextCurvePosition.value) {
          effortText = 'accelerating';
        }
        if (previousCurvePosition.value > nextCurvePosition.value) {
          effortText = 'decelerating';
        }

        previousGradientText = slopes.findLast(
          ({ position }) => xPositionReference(position.start) <= curveX!
        )!.value;
      } else {
        // find out from wich side the cursor is closer to the stop
        if (
          curveX - xPositionReference(previousStop.position.start) <=
          xPositionReference(nextStop.position.start) - curveX
        ) {
          curveX = xPositionReference(previousStop.position.start);
        } else {
          curveX = xPositionReference(nextStop.position.start);
        }

        const { previousPosition: nextSpeed, nextPosition: previousSpeed } =
          findPreviousAndNextPosition(speeds, curveX, xPositionReference);

        const { previousPosition: nextEcoSpeed, nextPosition: previousEcoSpeed } =
          findPreviousAndNextPosition(ecoSpeeds, curveX, xPositionReference);

        // find curveY based on the average speed between the previous and next speed values
        curveY =
          cursorBoxHeight -
          (((previousSpeed!.value + nextSpeed!.value) / 2 - minSpeed) / speedRange) *
            (cursorBoxHeight - CURVE_MARGIN_TOP);

        speedText = ((previousSpeed!.value + nextSpeed!.value) / 2).toFixed(1);

        ecoSpeedText = ((previousEcoSpeed!.value + nextEcoSpeed!.value) / 2).toFixed(1);

        if (nextSpeed!.value < previousSpeed!.value) {
          effortText = 'accelerating';
        }
        if (nextSpeed!.value > previousSpeed!.value) {
          effortText = 'decelerating';
        }

        previousGradientText = slopes.findLast(
          ({ position }) => xPositionReference(position.start) <= curveX!
        )!.value;
      }

      ctx.beginPath();
      // lines along the curve
      // horizontal
      ctx.moveTo(curveX + MARGIN_LEFT - RETICLE_LINE, curveY + MARGIN_TOP);
      ctx.lineTo(curveX + MARGIN_LEFT + RETICLE_LINE, curveY + MARGIN_TOP);
      ctx.stroke();
      // vertical
      ctx.moveTo(curveX + MARGIN_LEFT, curveY + MARGIN_TOP - RETICLE_LINE);
      ctx.lineTo(curveX + MARGIN_LEFT, curveY + MARGIN_TOP + RETICLE_LINE);

      // lines along the axis
      // horizontal
      ctx.moveTo(MARGIN_LEFT, curveY + MARGIN_TOP);
      ctx.lineTo(MARGIN_LEFT - 24, curveY + MARGIN_TOP);
      ctx.closePath();
      ctx.stroke();

      ctx.clearRect(0, height - MARGIN_BOTTOM, width, MARGIN_BOTTOM);

      // we need to draw the vertical line along the axis after all the other lines to clear them without this one
      ctx.beginPath();
      // vertical
      ctx.moveTo(curveX + MARGIN_LEFT, height - MARGIN_BOTTOM);
      ctx.lineTo(curveX + MARGIN_LEFT, height - MARGIN_BOTTOM + 6);

      // calculate the position value between x.a and x.b
      const position = Math.round(
        ((curveX - x.a) / (x.b - x.a)) *
          (nextCurvePosition!.position.start - previousCurvePosition!.position.start) +
          previousCurvePosition!.position.start
      );
      let textPosition = '';
      if (previousCurvePosition.position.start === 0 && nextCurvePosition.position.start === 0) {
        textPosition = '0';
      } else if (
        previousCurvePosition.position.start === maxPosition &&
        nextCurvePosition.position.start === maxPosition
      ) {
        textPosition = maxPosition.toFixed(1).toString();
      } else {
        textPosition = position.toFixed(1).toString();
      }

      ctx.textAlign = 'center';
      ctx.fillText(textPosition, curveX + MARGIN_LEFT, height - MARGIN_BOTTOM + 20);

      ctx.closePath();
      ctx.stroke();
    }

    ctx.clearRect(0, 0, width, MARGIN_TOP);
  }

  return {
    curveX,
    curveY,
    speedText,
    ecoSpeedText,
    effortText,
    electricalModeText,
    electricalProfileText,
    powerRestrictionText,
    previousGradientText,
    modeText,
  };
};
