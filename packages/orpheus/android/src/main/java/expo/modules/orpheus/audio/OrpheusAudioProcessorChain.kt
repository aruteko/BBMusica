package expo.modules.orpheus.audio

import androidx.annotation.OptIn
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.audio.DefaultAudioSink

/**
 * 在 ExoPlayer 默认的音频处理链（变速 / 跳过静音）后面追加 [LeadingSilenceSkipProcessor]。
 *
 * 被丢弃的帧要计入 getSkippedOutputFrameCount，否则 ExoPlayer 算出的播放位置会落后
 * 于实际的媒体时间（进度条、歌词都会错位）。
 */
@OptIn(UnstableApi::class)
class OrpheusAudioProcessorChain(
    val leadingSilenceProcessor: LeadingSilenceSkipProcessor,
) : DefaultAudioSink.AudioProcessorChain {

    private val delegate = DefaultAudioSink.DefaultAudioProcessorChain()
    private val processors: Array<AudioProcessor> =
        arrayOf(*delegate.audioProcessors, leadingSilenceProcessor)

    @Volatile
    private var speed = 1f

    override fun getAudioProcessors(): Array<AudioProcessor> = processors

    override fun applyPlaybackParameters(playbackParameters: PlaybackParameters): PlaybackParameters {
        speed = playbackParameters.speed
        return delegate.applyPlaybackParameters(playbackParameters)
    }

    override fun applySkipSilenceEnabled(skipSilenceEnabled: Boolean): Boolean =
        delegate.applySkipSilenceEnabled(skipSilenceEnabled)

    override fun getMediaDuration(playoutDuration: Long): Long =
        delegate.getMediaDuration(playoutDuration)

    override fun getSkippedOutputFrameCount(): Long {
        // 我们的处理器排在变速之后，丢弃的是输出域的帧，换算成媒体时间要乘以播放速度
        val ours = (leadingSilenceProcessor.skippedFrameCount * speed).toLong()
        return delegate.skippedOutputFrameCount + ours
    }
}
