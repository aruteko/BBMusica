import { StyleSheet, View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'

import Button from '@/components/common/Button'
import { t } from '@/i18n'

interface DownloadHeaderProps {
	taskCount: number
	retryableCount: number
	onRetryAll: () => void
	onClearAll: () => void
}

/**
 * 下载页面的操作栏，显示任务总数、全部开始和清除按钮。
 */
export default function DownloadHeader({
	taskCount,
	retryableCount,
	onRetryAll,
	onClearAll,
}: DownloadHeaderProps) {
	const { colors } = useTheme()

	return (
		<View
			style={[styles.container, { borderBottomColor: colors.outlineVariant }]}
		>
			<Text
				variant='bodyMedium'
				style={{ color: colors.onSurfaceVariant }}
			>{t('合計 ')}{taskCount}{t(' 件のタスク')}</Text>
			<View style={styles.buttonContainer}>
				<Button
					mode='outlined'
					onPress={onRetryAll}
					disabled={retryableCount === 0}
				>{t('失敗を再試行')}</Button>
				<Button
					mode='outlined'
					onPress={onClearAll}
					disabled={taskCount === 0}
				>{t('すべて消去')}</Button>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderBottomWidth: 1,
	},
	buttonContainer: {
		flexDirection: 'row',
		gap: 8,
	},
})
