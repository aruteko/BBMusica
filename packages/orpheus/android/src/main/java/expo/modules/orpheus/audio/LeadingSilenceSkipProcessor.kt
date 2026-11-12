package expo.modules.orpheus.audio

import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.BaseAudioProcessor
import androidx.media3.common.util.UnstableApi
import expo.modules.orpheus.util.GeneralStorage
import java.nio.ByteBuffer
import kotlin.math.abs

/**
 * 只跳过「曲目开头」的静音（16-bit PCM）。
 *
 * 与 ExoPlayer 自带的 SilenceSkippingAudioProcessor 不同，它不会处理曲目中间的静音。
 *
 * 什么时候算「曲目开头」：
 * - 播放器切到另一首（[armForNextStream]，由 Player.Listener 在切歌/换列表时调用），
 * - 或者上一条流已经正常结束（onQueueEndOfStream）后紧接着的下一条流（自动连播、单曲循环），
 * - 或者处理器刚创建后的第一条流。
 * 同一首歌里的拖动进度（flush 之前没有结束标记）不会触发跳过。
 *
 * 开头静音最多跳过 [MAX_SKIP_US]，并在第一个有声音的采样前保留 [PADDING_US]，避免切掉起音。
 */
@OptIn(UnstableApi::class)
class LeadingSilenceSkipProcessor : BaseAudioProcessor() {

    private fun isEnabled(): Boolean =
        runCatching { GeneralStorage.isLeadingSilenceSkipEnabled() }.getOrDefault(false)

    /** 播放器已经切到另一首歌（主线程设置，下一次 flush 时消费）。 */
    @Volatile
    private var armedByPlayer = false

    /** 上一条流正常结束，或者处理器刚创建：下一次 flush 开始的就是新曲目。 */
    private var armedByStreamEnd = true

    private var skipping = false
    private var skippedFrames = 0L
    private var maxSkipFrames = 0L
    private var paddingFrames = 0L

    /** 自上次 flush 以来被丢弃的帧数（给 ExoPlayer 校正播放位置用）。 */
    @Volatile
    var skippedFrameCount: Long = 0L
        private set

    fun armForNextStream() {
        armedByPlayer = true
    }

    override fun onConfigure(inputAudioFormat: AudioProcessor.AudioFormat): AudioProcessor.AudioFormat {
        if (inputAudioFormat.encoding != C.ENCODING_PCM_16BIT) {
            // NOT_SET 表示处理器不参与（直通），不会影响播放
            return AudioProcessor.AudioFormat.NOT_SET
        }
        maxSkipFrames = inputAudioFormat.sampleRate * MAX_SKIP_US / 1_000_000
        paddingFrames = inputAudioFormat.sampleRate * PADDING_US / 1_000_000
        return inputAudioFormat
    }

    override fun onFlush(streamMetadata: AudioProcessor.StreamMetadata) {
        skipping = (armedByPlayer || armedByStreamEnd) && isEnabled()
        armedByPlayer = false
        armedByStreamEnd = false
        skippedFrames = 0L
        skippedFrameCount = 0L
    }

    override fun onQueueEndOfStream() {
        // 这条流正常播完，接下来的 flush 属于新的曲目
        armedByStreamEnd = true
    }

    override fun onReset() {
        skipping = false
        skippedFrames = 0L
        skippedFrameCount = 0L
        armedByStreamEnd = true
    }

    override fun queueInput(inputBuffer: ByteBuffer) {
        if (!skipping) {
            passThrough(inputBuffer)
            return
        }

        val frameSize = inputAudioFormat.bytesPerFrame
        val channels = inputAudioFormat.channelCount
        val start = inputBuffer.position()
        val limit = inputBuffer.limit()
        val frames = (limit - start) / frameSize

        var firstLoudFrame = -1
        var frame = 0
        while (frame < frames && firstLoudFrame < 0) {
            val base = start + frame * frameSize
            for (channel in 0 until channels) {
                val sample = inputBuffer.getShort(base + channel * 2).toInt()
                if (abs(sample) > SILENCE_THRESHOLD) {
                    firstLoudFrame = frame
                    break
                }
            }
            frame++
        }

        if (firstLoudFrame < 0) {
            // 整块都是静音：全部丢弃。超过上限后不再跳过，后续原样播放。
            inputBuffer.position(limit)
            skippedFrames += frames
            skippedFrameCount += frames
            if (skippedFrames >= maxSkipFrames) skipping = false
            return
        }

        val keepFrom = maxOf(0L, firstLoudFrame - paddingFrames).toInt()
        val dropped = keepFrom.toLong()
        inputBuffer.position(start + keepFrom * frameSize)
        skippedFrames += dropped
        skippedFrameCount += dropped
        skipping = false
        passThrough(inputBuffer)
    }

    private fun passThrough(inputBuffer: ByteBuffer) {
        val remaining = inputBuffer.remaining()
        if (remaining == 0) return
        val output = replaceOutputBuffer(remaining)
        output.put(inputBuffer)
        output.flip()
    }

    companion object {
        /** 开头静音最多跳过的时长（微秒） */
        private const val MAX_SKIP_US = 6_000_000L

        /** 第一个有声音的采样之前保留的时长（微秒） */
        private const val PADDING_US = 30_000L

        /** 16-bit 采样的绝对值不超过它就视为静音（约 -48 dBFS） */
        private const val SILENCE_THRESHOLD = 128
    }
}
