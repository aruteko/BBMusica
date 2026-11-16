import { useRouter } from 'expo-router'
import { memo } from 'react'
import { StyleSheet, View } from 'react-native'
import { Icon, Text, useTheme } from 'react-native-paper'

import GridCard from '@/components/common/GridCard'
import PlaylistCover from '@/components/common/PlaylistCover'
import type { Playlist } from '@/types/core/media'
import { t } from '@/i18n'

const LocalPlaylistItem = memo(
	({ item }: { item: Playlist & { isToView?: boolean } }) => {
		const router = useRouter()
		const { colors } = useTheme()
		const isShared = !!item.shareId
		const isRemote = item.type !== 'local' && item.type !== 'dynamic'

		return (
			<GridCard
				testID={`local-playlist-${item.id}`}
				title={item.title}
				onPress={() => {
					router.navigate({
						pathname: item.isToView
							? '/playlist/remote/toview'
							: '/playlist/local/[id]',
						params: { id: String(item.id) },
					})
				}}
				renderCover={(size) => (
					<PlaylistCover
						id={item.id}
						cover={item.coverUrl}
						previewCovers={item.previewCovers}
						title={item.title}
						size={size}
					/>
				)}
				subtitle={
					<View style={styles.subtitleContainer}>
						<Text
							variant='bodySmall'
							numberOfLines={1}
							style={styles.subtitleText}
						>
							{item.isToView
								? t('あとで見る')
								: `${item.itemCount}${t(' 曲')}`}
						</Text>
						{item.isPinned && (
							<Icon
								source='pin'
								color={colors.primary}
								size={13}
							/>
						)}
						{isShared && (
							<Icon
								source='account-group'
								color={colors.primary}
								size={13}
							/>
						)}
						{!isShared && isRemote && (
							<Icon
								source={'cloud'}
								color={colors.primary}
								size={13}
							/>
						)}
						{item.type === 'dynamic' && (
							<Icon
								source='merge'
								color={colors.primary}
								size={13}
							/>
						)}
					</View>
				}
			/>
		)
	},
)

const styles = StyleSheet.create({
	subtitleContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
	},
	subtitleText: { opacity: 0.7, flexShrink: 1 },
})

LocalPlaylistItem.displayName = 'LocalPlaylistItem'

export default LocalPlaylistItem
