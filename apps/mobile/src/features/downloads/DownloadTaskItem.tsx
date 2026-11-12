import { DownloadState, Orpheus, type DownloadTask } from '@bbplayer/orpheus'
import { useRecyclingState } from '@legendapp/list/react-native'
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { ViewInstance } from 'react-native'
import { StyleSheet, View } from 'react-native'
import { Icon, Surface, Text, useTheme } from 'react-native-paper'
import Animated, {
	useAnimatedStyle,
	useSharedValue,
} from 'react-native-reanimated'

import IconButton from '@/components/common/IconButton'
import {
	eventListner,
	type ProgressEvent,
} from '@/hooks/stores/useDownloadManagerStore'
import { toastAndLogError } from '@/utils/error-handling'

const canRetryDownloadTask = (task: DownloadTask) =>
	!!task.track &&
	(task.state === DownloadState.FAILED || task.state === DownloadState.STOPPED)

const DownloadTaskItem = memo(function DownloadTaskItem({
	initTask,
}: {
	initTask: DownloadTask
}) {
	const { colors } = useTheme()
	const [task, setTask] = useRecyclingState<DownloadTask>(initTask)
	const sharedProgress = useSharedValue(0)
	const progressBackgroundWidth = useSharedValue(0)
	const containerRef = useRef<ViewInstance>(null)
	const retryable = canRetryDownloadTask(task)
	const retryTrack = task.track
	const retryState = task.state

	useEffect(() => {
		const handler = (e: ProgressEvent['progress:uniqueKey']) => {
			sharedProgress.value = e.percent
			if (e.state !== task.state) {
				setTask((t) => ({ ...t, state: e.state }))
			}
		}
		eventListner.on(`progress:${task.id}`, handler)

		return () => {
			eventListner.off(`progress:${task.id}`, handler)
		}
	}, [task.id, sharedProgress, task.state, setTask])

	useLayoutEffect(() => {
		if (!containerRef.current) return
		containerRef.current.measure((_x, _y, width) => {
			progressBackgroundWidth.value = width
		})
	}, [progressBackgroundWidth])

	useEffect(() => {
		// 只清除当前任务的进度，而不清除 progressBackgroundWidth
		sharedProgress.set(0)
	}, [sharedProgress, task.id])

	const progressBackgroundAnimatedStyle = useAnimatedStyle(() => {
		return {
			transform: [
				{
					translateX:
						(sharedProgress.value - 1) * progressBackgroundWidth.value,
				},
			],
		}
	})

	const getStatusText = () => {
		switch (task.state) {
			case DownloadState.QUEUED:
				return 'ダウンロード待ち...'
			case DownloadState.DOWNLOADING:
				return 'ダウンロード中...'
			case DownloadState.FAILED:
				return 'ダウンロードに失敗しました'
			case DownloadState.STOPPED:
				return '停止しました'
			case DownloadState.REMOVING:
				return '削除中...'
			case DownloadState.RESTARTING:
				return '再試行中...'
			case DownloadState.COMPLETED:
				return 'ダウンロード完了'
			default:
				return '不明な状態'
		}
	}

	const icons = useMemo(() => {
		let icon = null
		switch (task.state) {
			case DownloadState.QUEUED:
				icon = (
					<Icon
						source='human-queue'
						size={24}
					/>
				)
				break
			case DownloadState.DOWNLOADING:
				icon = (
					<Icon
						source='progress-download'
						size={24}
					/>
				)
				break
			case DownloadState.FAILED:
				icon = (
					<Icon
						source='close-circle-outline'
						size={24}
						color={colors.error}
					/>
				)
				break
			case DownloadState.COMPLETED:
				icon = (
					<Icon
						source='check-circle-outline'
						size={24}
					/>
				)
				break
			default:
				icon = (
					<Icon
						source='help-circle-outline'
						size={24}
					/>
				)
				break
		}

		return (
			<>
				<View style={styles.iconsContainer}>
					{retryable && (
						<IconButton
							icon='reload'
							onPress={async () => {
								if (!retryTrack) return
								try {
									if (retryState === DownloadState.STOPPED) {
										await Orpheus.resumeDownload(task.id)
									} else {
										await Orpheus.retryDownload(retryTrack)
									}
								} catch (e) {
									toastAndLogError(
										'再ダウンロードに失敗しました',
										e,
										'Features.Downloads.DownloadTaskItem',
									)
								}
							}}
						/>
					)}
					<View>{icon}</View>
					<IconButton
						icon='close'
						onPress={async () => {
							try {
								await Orpheus.removeDownload(task.id)
							} catch (e) {
								toastAndLogError(
									'タスクの削除に失敗しました',
									e,
									'Features.Downloads.DownloadTaskItem',
								)
							}
						}}
					/>
				</View>
			</>
		)
	}, [colors.error, retryState, retryTrack, retryable, task.id, task.state])

	return (
		<>
			<Surface
				ref={containerRef}
				style={styles.surface}
				elevation={0}
			>
				<View style={styles.itemContainer}>
					<View style={styles.textContainer}>
						<Text
							variant='bodyMedium'
							numberOfLines={1}
						>
							{task.track?.title ?? '不明なタスク'}
						</Text>
						<View style={styles.statusContainer}>
							<Text
								variant='bodySmall'
								style={{ color: colors.onSurfaceVariant }}
							>
								{getStatusText()}
							</Text>
						</View>
					</View>

					<View style={styles.iconsOuterContainer}>{icons}</View>
				</View>
			</Surface>
			<Animated.View
				style={[
					progressBackgroundAnimatedStyle,
					styles.progressBackground,
					{ backgroundColor: colors.surfaceVariant },
				]}
			></Animated.View>
		</>
	)
})

const styles = StyleSheet.create({
	surface: {
		borderRadius: 8,
		backgroundColor: 'transparent',
		marginVertical: 4,
		marginHorizontal: 8,
		position: 'relative',
		width: '100%',
	},
	itemContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 8,
		paddingVertical: 8,
	},
	textContainer: {
		marginLeft: 12,
		flex: 1,
		marginRight: 4,
		justifyContent: 'center',
	},
	statusContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 2,
	},
	iconsOuterContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'flex-end',
	},
	iconsContainer: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	progressBackground: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		zIndex: -100,
		width: '100%',
	},
})

export default DownloadTaskItem
