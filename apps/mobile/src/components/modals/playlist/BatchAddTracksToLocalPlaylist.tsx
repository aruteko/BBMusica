import { LegendList } from '@legendapp/list/react-native'
import { memo, useCallback, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Dialog, RadioButton, Text, useTheme } from 'react-native-paper'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import Button from '@/components/common/Button'
import { useBatchAddTracksToLocalPlaylist } from '@/hooks/mutations/db/playlist'
import { usePlaylistLists } from '@/hooks/queries/db/playlist'
import { useModalStore } from '@/hooks/stores/useModalStore'
import type { Playlist } from '@/types/core/media'
import type { ListRenderItemInfoWithExtraData } from '@/types/legendlist'
import type { CreateArtistPayload } from '@/types/services/artist'
import type { CreateTrackPayload } from '@/types/services/track'
import { t } from '@/i18n'

const renderPlaylistItem = ({
	item,
	extraData,
}: ListRenderItemInfoWithExtraData<
	Playlist,
	{ selectedPlaylistId: number; setSelectedPlaylistId: (id: number) => void }
>) => {
	if (!extraData) throw new Error(t('Extradata がありません'))
	const isChecked = extraData.selectedPlaylistId === item.id
	const isDisabled = item.type !== 'local'
	const setSelectedPlaylistId = extraData.setSelectedPlaylistId

	return (
		<RadioButton.Item
			label={item.title}
			value={String(item.id)}
			status={isChecked ? 'checked' : 'unchecked'}
			onPress={() => !isDisabled && setSelectedPlaylistId(item.id)}
			disabled={isDisabled}
		/>
	)
}

const BatchAddTracksToLocalPlaylistModal = memo(
	function AddTracksToLocalPlaylistModal({
		payloads,
	}: {
		payloads: { track: CreateTrackPayload; artist: CreateArtistPayload }[]
	}) {
		const { colors } = useTheme()
		const modalClose = useModalStore((state) => state.close)
		const close = useCallback(
			() => modalClose('BatchAddTracksToLocalPlaylist'),
			[modalClose],
		)
		const openModal = useModalStore((state) => state.open)

		const {
			data: allPlaylists,
			isPending: isPlaylistsPending,
			isError: isPlaylistsError,
			refetch: refetchPlaylists,
		} = usePlaylistLists()
		const filteredPlaylists = useMemo(
			() =>
				allPlaylists?.filter(
					(p) => p.type === 'local' && p.shareRole !== 'subscriber',
				),
			[allPlaylists],
		)

		const { mutate: batchAdd, isPending: isMutating } =
			useBatchAddTracksToLocalPlaylist()

		const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(
			null,
		)

		const isLoading = isPlaylistsPending
		const isError = isPlaylistsError

		const handleDismiss = useCallback(() => {
			if (isMutating) return
			close()
		}, [close, isMutating])

		const handleRetry = useCallback(() => {
			if (isPlaylistsError) void refetchPlaylists()
		}, [isPlaylistsError, refetchPlaylists])

		const handleConfirm = useCallback(() => {
			if (isMutating || selectedPlaylistId == null) return

			batchAdd(
				{
					playlistId: selectedPlaylistId,
					payloads,
				},
				{
					onSettled: () => close(),
				},
			)
		}, [batchAdd, close, isMutating, payloads, selectedPlaylistId])

		const keyExtractor = useCallback((item: Playlist) => item.id.toString(), [])

		const extraData = useMemo(
			() => ({
				selectedPlaylistId,
				setSelectedPlaylistId,
			}),
			[selectedPlaylistId, setSelectedPlaylistId],
		)

		const renderContent = () => {
			if (isLoading) {
				return (
					<Dialog.Content style={styles.loadingContainer}>
						<ActivityIndicator size={'large'} />
					</Dialog.Content>
				)
			}

			if (isError) {
				return (
					<>
						<Dialog.Content>
							<Text style={[styles.errorText, { color: colors.error }]}>{t('プレイリスト一覧の読み込みに失敗しました')}</Text>
						</Dialog.Content>
						<Dialog.Actions>
							<Button onPress={handleDismiss}>{t('閉じる')}</Button>
							<Button onPress={handleRetry}>{t('再試行')}</Button>
						</Dialog.Actions>
					</>
				)
			}

			return (
				<>
					<Dialog.ScrollArea style={styles.listContainer}>
						<LegendList
							data={filteredPlaylists ?? []}
							renderItem={renderPlaylistItem}
							keyExtractor={keyExtractor}
							extraData={extraData}
							recycleItems
							showsVerticalScrollIndicator={false}
							ListEmptyComponent={
								<View style={styles.emptyListContainer}>
									<Text>{t('まだプレイリストを作成していません')}</Text>
								</View>
							}
						/>
					</Dialog.ScrollArea>
					<Dialog.Content>
						<Text variant='bodySmall'>
							*{'\u2009'}{t('リモート同期・購読中のプレイリストは表示されません')}</Text>
					</Dialog.Content>
					<Dialog.Actions style={styles.actionsContainer}>
						<Button
							onPress={() =>
								openModal('CreatePlaylist', { redirectToNewPlaylist: false })
							}
						>{t('新規作成')}</Button>
						<View style={styles.rightActionsContainer}>
							<Button
								onPress={handleDismiss}
								disabled={isMutating}
							>{t('キャンセル')}</Button>
							<Button
								onPress={handleConfirm}
								loading={isMutating}
								disabled={isMutating || selectedPlaylistId == null}
							>{t('追加')}</Button>
						</View>
					</Dialog.Actions>
				</>
			)
		}

		return (
			<>
				<Dialog.Title>{t('プレイリストに追加')}</Dialog.Title>
				{renderContent()}
			</>
		)
	},
)

const styles = StyleSheet.create({
	loadingContainer: {
		alignItems: 'center',
		paddingVertical: 20,
	},
	errorText: {
		textAlign: 'center',
	},
	listContainer: {
		minHeight: 300,
	},
	emptyListContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	actionsContainer: {
		justifyContent: 'space-between',
	},
	rightActionsContainer: {
		flexDirection: 'row',
		alignItems: 'center',
	},
})

BatchAddTracksToLocalPlaylistModal.displayName = 'AddTracksToLocalPlaylistModal'

export default BatchAddTracksToLocalPlaylistModal
