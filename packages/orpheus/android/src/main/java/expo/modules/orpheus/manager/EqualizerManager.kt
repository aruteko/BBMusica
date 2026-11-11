package expo.modules.orpheus.manager

import android.media.audiofx.Equalizer
import android.util.Log
import androidx.media3.common.C
import expo.modules.orpheus.util.GeneralStorage

/**
 * 系统均衡器（android.media.audiofx.Equalizer）的封装。
 *
 * 均衡器绑定在播放器的 audioSessionId 上，会话变化时需要重新绑定；
 * 开关与各频段增益保存在 GeneralStorage 中，重新绑定时自动恢复。
 */
class EqualizerManager {
    private var equalizer: Equalizer? = null
    private var attachedSessionId = C.AUDIO_SESSION_ID_UNSET

    /** 绑定到指定的音频会话；已经绑定到同一会话时什么也不做。 */
    @Synchronized
    fun ensureAttached(audioSessionId: Int) {
        if (audioSessionId == C.AUDIO_SESSION_ID_UNSET) return
        if (equalizer != null && attachedSessionId == audioSessionId) return
        release()
        try {
            val eq = Equalizer(0, audioSessionId)
            val bandCount = eq.numberOfBands.toInt()
            val saved = GeneralStorage.getEqualizerLevels()
            if (saved.size == bandCount) {
                saved.forEachIndexed { index, level ->
                    eq.setBandLevel(index.toShort(), clampLevel(eq, level).toShort())
                }
            }
            eq.enabled = GeneralStorage.isEqualizerEnabled()
            equalizer = eq
            attachedSessionId = audioSessionId
        } catch (e: Exception) {
            Log.e("Orpheus", "Failed to attach equalizer", e)
            equalizer = null
            attachedSessionId = C.AUDIO_SESSION_ID_UNSET
        }
    }

    @Synchronized
    fun release() {
        equalizer?.let {
            runCatching { it.release() }
        }
        equalizer = null
        attachedSessionId = C.AUDIO_SESSION_ID_UNSET
    }

    @Synchronized
    fun setEnabled(enabled: Boolean) {
        GeneralStorage.setEqualizerEnabled(enabled)
        runCatching { equalizer?.enabled = enabled }
            .onFailure { Log.e("Orpheus", "Failed to toggle equalizer", it) }
    }

    @Synchronized
    fun setBandLevel(band: Int, level: Int) {
        val eq = equalizer ?: return
        runCatching {
            if (band < 0 || band >= eq.numberOfBands) return
            eq.setBandLevel(band.toShort(), clampLevel(eq, level).toShort())
            persist(eq)
        }.onFailure { Log.e("Orpheus", "Failed to set equalizer band", it) }
    }

    @Synchronized
    fun usePreset(index: Int) {
        val eq = equalizer ?: return
        runCatching {
            if (index < 0 || index >= eq.numberOfPresets) return
            eq.usePreset(index.toShort())
            persist(eq)
        }.onFailure { Log.e("Orpheus", "Failed to use equalizer preset", it) }
    }

    @Synchronized
    fun reset() {
        val eq = equalizer ?: run {
            GeneralStorage.setEqualizerLevels(emptyList())
            return
        }
        runCatching {
            for (band in 0 until eq.numberOfBands) {
                eq.setBandLevel(band.toShort(), 0)
            }
            persist(eq)
        }.onFailure { Log.e("Orpheus", "Failed to reset equalizer", it) }
    }

    /** 返回给 JS 的状态。均衡器尚未绑定（还没有播放过）时 available 为 false。 */
    @Synchronized
    fun info(): Map<String, Any?> {
        val eq = equalizer
        val enabled = GeneralStorage.isEqualizerEnabled()
        if (eq == null) {
            return mapOf("available" to false, "enabled" to enabled)
        }
        return try {
            val range = eq.bandLevelRange
            val bands = (0 until eq.numberOfBands.toInt()).map { band ->
                mapOf(
                    "index" to band,
                    // getCenterFreq 的单位是 milliHertz
                    "centerFreq" to eq.getCenterFreq(band.toShort()) / 1000,
                    "level" to eq.getBandLevel(band.toShort()).toInt(),
                )
            }
            val presets = (0 until eq.numberOfPresets.toInt()).map { preset ->
                eq.getPresetName(preset.toShort())
            }
            mapOf(
                "available" to true,
                "enabled" to enabled,
                "minLevel" to range[0].toInt(),
                "maxLevel" to range[1].toInt(),
                "bands" to bands,
                "presets" to presets,
            )
        } catch (e: Exception) {
            Log.e("Orpheus", "Failed to read equalizer info", e)
            mapOf("available" to false, "enabled" to enabled)
        }
    }

    private fun persist(eq: Equalizer) {
        val levels = (0 until eq.numberOfBands.toInt()).map { band ->
            eq.getBandLevel(band.toShort()).toInt()
        }
        GeneralStorage.setEqualizerLevels(levels)
    }

    private fun clampLevel(eq: Equalizer, level: Int): Int {
        val range = eq.bandLevelRange
        return level.coerceIn(range[0].toInt(), range[1].toInt())
    }
}
