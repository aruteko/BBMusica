import { Orpheus } from '@bbplayer/orpheus'
import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { useVideoStreamUrl } from '@/hooks/queries/bilibili/videoStream'

/** 音声（Orpheus）の再生位置と動画の位置のずれがこれ（秒）を超えたら動画側を合わせる */
const MAX_DRIFT_SECONDS = 0.35
const SYNC_INTERVAL_MS = 700

function buildHtml(streamUrl: string) {
	// 動画は常にミュート（音は Orpheus が再生する）。操作は RN 側からの __sync だけで行う。
	return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
  video { width: 100%; height: 100%; object-fit: contain; background: #000; }
</style>
</head>
<body>
<video id="v" muted playsinline webkit-playsinline preload="auto"></video>
<script>
  var v = document.getElementById('v');
  function post(type) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: type })); } catch (e) {}
  }
  v.addEventListener('loadeddata', function () { post('ready'); });
  v.addEventListener('error', function () { post('error'); });
  window.__sync = function (pos, playing, rate) {
    if (v.readyState < 1) return;
    v.muted = true;
    if (rate && v.playbackRate !== rate) v.playbackRate = rate;
    if (Math.abs(v.currentTime - pos) > ${MAX_DRIFT_SECONDS}) v.currentTime = pos;
    if (playing) {
      if (v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    } else if (!v.paused) {
      v.pause();
    }
  };
  v.src = ${JSON.stringify(streamUrl)};
  v.load();
</script>
</body>
</html>`
}

/**
 * プレーヤーの右端のページ：再生中の曲の動画（MV）を表示する。
 *
 * 動画はミュートで再生し、音声は今までどおり Orpheus が再生する。
 * 動画の位置は Orpheus の再生位置に合わせ続ける（一時停止・シーク・倍速にも追従）。
 * ページが表示されている間だけ動画を読み込む（データ通信を節約するため）。
 */
export default function PlayerVideo({ active }: { active: boolean }) {
	const track = useCurrentTrack()
	const { data: streamUrl, isPending, isError } = useVideoStreamUrl(track, active)
	const webViewRef = useRef<WebView<object>>(null)
	const [ready, setReady] = useState(false)
	const [failed, setFailed] = useState(false)

	const html = useMemo(
		() => (streamUrl ? buildHtml(streamUrl) : undefined),
		[streamUrl],
	)

	// 曲 / 動画が変わったら読み込み状態を戻す
	useEffect(() => {
		setReady(false)
		setFailed(false)
	}, [streamUrl])

	// Orpheus の状態を動画に反映する
	useEffect(() => {
		if (!active || !ready) return
		let cancelled = false
		const tick = async () => {
			try {
				const [position, playing, rate] = await Promise.all([
					Orpheus.getPosition(),
					Orpheus.getIsPlaying(),
					Orpheus.getPlaybackSpeed(),
				])
				if (cancelled) return
				webViewRef.current?.injectJavaScript(
					`window.__sync(${position}, ${playing}, ${rate}); true;`,
				)
			} catch {
				// 状態の取得に失敗しても、次の周期で再試行する
			}
		}
		void tick()
		const timer = setInterval(() => void tick(), SYNC_INTERVAL_MS)
		return () => {
			cancelled = true
			clearInterval(timer)
		}
	}, [active, ready, streamUrl])

	const handleMessage = (event: WebViewMessageEvent) => {
		try {
			const data = JSON.parse(event.nativeEvent.data) as { type?: string }
			if (data.type === 'ready') setReady(true)
			else if (data.type === 'error') setFailed(true)
		} catch {
			// 想定外のメッセージは無視する
		}
	}

	let overlay: React.ReactNode = null
	if (!track || track.source !== 'bilibili') {
		overlay = <Text style={styles.message}>この曲には動画がありません</Text>
	} else if (isError || failed) {
		overlay = <Text style={styles.message}>動画を読み込めませんでした</Text>
	} else if (isPending || !ready) {
		overlay = <ActivityIndicator color='#fff' />
	}

	return (
		<View style={styles.container}>
			{active && html && !isError && (
				<WebView
					key={streamUrl}
					ref={webViewRef}
					style={styles.webView}
					source={{ html, baseUrl: 'https://www.bilibili.com' }}
					originWhitelist={['*']}
					javaScriptEnabled
					mediaPlaybackRequiresUserAction={false}
					allowsInlineMediaPlayback
					scrollEnabled={false}
					onMessage={handleMessage}
					// 動画以外の画面遷移は許可しない
					onShouldStartLoadWithRequest={(request) =>
						request.url === 'about:blank' ||
						request.url.startsWith('https://www.bilibili.com')
					}
				/>
			)}
			{overlay && (
				<View
					style={styles.overlay}
					pointerEvents='none'
				>
					{overlay}
				</View>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: 'center',
		backgroundColor: '#000',
		borderRadius: 16,
		overflow: 'hidden',
		marginHorizontal: 8,
		marginBottom: 24,
	},
	webView: {
		flex: 1,
		backgroundColor: '#000',
	},
	overlay: {
		...StyleSheet.absoluteFill,
		alignItems: 'center',
		justifyContent: 'center',
	},
	message: {
		color: '#fff',
		textAlign: 'center',
		paddingHorizontal: 24,
	},
})
