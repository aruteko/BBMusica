package expo.modules.orpheus.util

import kotlin.math.pow

/**
 * 响度均衡计算
 * @param measuredI 实测响度
 * @param targetI 目标响度
 * @return gain
 */
fun calculateLoudnessGain(measuredI: Double, targetI: Double = -14.0): Float {

    if (measuredI == 0.0) {
        return 1.0f
    }

    val gainDb = targetI - measuredI
    val linearFactor = 10.0.pow(gainDb / 20.0).toFloat()

    val finalResult = linearFactor.coerceIn(0.0f, 1.0f)

    return finalResult
}
