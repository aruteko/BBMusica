import { useMutation } from '@tanstack/react-query'

import { playlistKeys } from '@/hooks/queries/db/playlist'
import { queryClient } from '@/lib/config/queryClient'
import { playlistFacade } from '@/lib/facades/playlist'
import type { PlaylistSyncProgress } from '@/lib/facades/syncBilibiliPlaylist'
import { syncFacade } from '@/lib/facades/syncBilibiliPlaylist'
import { playlistService } from '@/lib/services/playlistService'
import type { Playlist } from '@/types/core/media'
import type { CreateArtistPayload } from '@/types/services/artist'
import type { UpdatePlaylistPayload } from '@/types/services/playlist'
import type { CreateTrackPayload } from '@/types/services/track'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'
import { t } from '@/i18n'

const SCOPE = 'Mutation.DB.Playlist'

queryClient.setMutationDefaults(['db', 'playlist'], {
	retry: false,
	networkMode: 'always',
})

// React Query 的 invalidateQueries 会直接在后台刷新当前页面活跃的查询，能满足咱们的需求。
// 只有当我们需要在 mutate 之后要跳转到另一个页面时，才需要去 invalidateQueries
export const usePlaylistSync = () => {
	return useMutation({
		mutationKey: ['db', 'playlist', 'sync'],
		mutationFn: async ({
			remoteSyncId,
			type,
			onProgress,
			expandMultiPage,
		}: {
			remoteSyncId: number
			type: Playlist['type']
			toastId?: string
			onProgress?: (progress: PlaylistSyncProgress) => void
			expandMultiPage?: boolean
		}) => {
			const result = await syncFacade.sync(
				remoteSyncId,
				type,
				onProgress,
				expandMultiPage,
			)
			if (result.isErr()) {
				throw result.error
			}
			return result.value
		},
		onSuccess: async (id, { toastId }) => {
			toast.success(t('同期しました'), { id: toastId })
			if (!id) return
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistContents(id),
				}),
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistMetadata(id),
				}),
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistLists(),
				}),
			])
		},
		onError: (error, { remoteSyncId, type, toastId }) => {
			if (toastId) {
				toast.dismiss(toastId)
			}
			toastAndLogError(
				`${t('プレイリストの同期に失敗しました: remoteSyncId=')}${remoteSyncId}, type=${type}`,
				error,
				SCOPE,
			)
		},
	})
}

/**
 * 针对单个音轨，批量更新它所在的本地播放列表。
 * 当该 track 不存在时，会自动创建
 * 你可能并不需要直接使用此 mutation，请去使用 <AddVideoToLocalPlaylistModal /> 组件
 * @returns
 */
export const useUpdateTrackLocalPlaylists = () => {
	return useMutation({
		mutationKey: ['db', 'playlist', 'updateTrackLocalPlaylists'],
		mutationFn: async (args: {
			toAddPlaylistIds: number[]
			toRemovePlaylistIds: number[]
			trackPayload: CreateTrackPayload
			artistPayload?: CreateArtistPayload | null
		}) => {
			const res = await playlistFacade.updateTrackLocalPlaylists(args)
			if (res.isErr()) throw res.error
			return res.value
		},
		onSuccess: async (trackId, { toAddPlaylistIds, toRemovePlaylistIds }) => {
			toast.success(t('操作しました'))
			const promises: Promise<unknown>[] = []
			promises.push(
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistsContainingTrack(trackId),
				}),
			)
			promises.push(
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistLists(),
				}),
			)
			for (const id of [...toAddPlaylistIds, ...toRemovePlaylistIds]) {
				promises.push(
					queryClient.invalidateQueries({
						queryKey: playlistKeys.playlistContents(id),
					}),
				)
				promises.push(
					queryClient.invalidateQueries({
						queryKey: playlistKeys.playlistMetadata(id),
					}),
				)
			}
			await Promise.all(promises)
		},
		onError: (error, { trackPayload }) =>
			toastAndLogError(
				`${t('曲のプレイリスト登録の操作に失敗しました: trackTitle=')}${trackPayload.title}`,
				error,
				SCOPE,
			),
	})
}

export const useDuplicatePlaylist = () => {
	return useMutation({
		mutationKey: ['db', 'playlist', 'duplicatePlaylist'],
		mutationFn: async ({
			playlistId,
			name,
		}: {
			playlistId: number
			name: string
		}) => {
			const result = await playlistFacade.duplicatePlaylist(playlistId, name)
			if (result.isErr()) {
				throw result.error
			}
			return result.value
		},
		onSuccess: async () => {
			toast.success(t('複製しました'))
			await queryClient.invalidateQueries({
				queryKey: playlistKeys.playlistLists(),
			})
		},
		onError: (error, { playlistId, name }) =>
			toastAndLogError(
				`${t('プレイリストを複製できませんでした: playlistId=')}${playlistId}, name=${name}`,
				error,
				SCOPE,
			),
	})
}

export const useEditPlaylistMetadata = () => {
	return useMutation({
		mutationKey: ['db', 'playlist', 'editPlaylistMetadata'],
		mutationFn: async ({
			playlistId,
			payload,
		}: {
			playlistId: number
			payload: UpdatePlaylistPayload
		}) => {
			if (playlistId === 0) return
			const result = await playlistFacade.updatePlaylistMetadata(
				playlistId,
				payload,
			)
			if (result.isErr()) {
				throw result.error
			}
			return result.value
		},
		onSuccess: async (_, variables) => {
			toast.success(t('操作しました'))
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistLists(),
				}),
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistMetadata(variables.playlistId),
				}),
			])
		},
		onError: (error, { playlistId }) =>
			toastAndLogError(
				`${t('プレイリスト情報の変更に失敗しました：playlistId=')}${playlistId}`,
				error,
				SCOPE,
			),
	})
}

export const useDeletePlaylist = () => {
	return useMutation({
		mutationKey: ['db', 'playlist', 'deletePlaylist'],
		mutationFn: async ({ playlistId }: { playlistId: number }) => {
			const result = await playlistFacade.deletePlaylist(playlistId)
			if (result.isErr()) {
				throw result.error
			}
			return result.value
		},
		onSuccess: (_, { playlistId }) => {
			toast.success(t('削除しました'))
			// 取消被删歌单的在途查询：删除成功时详情页可能仍处于挂载状态，
			// 若不处理，重连/重取会在歌单已不存在时再次查询（BBPLAYER-76 / BBPLAYER-AG）
			void queryClient.cancelQueries({
				queryKey: playlistKeys.playlistContents(playlistId),
			})
			void queryClient.cancelQueries({
				queryKey: playlistKeys.playlistMetadata(playlistId),
			})
			// 注意不要 await：hook 级 onSuccess 会阻塞调用方的 onSuccess（如 router.back()），
			// 导致详情页迟迟不卸载，放大上面的竞态窗口
			void queryClient.invalidateQueries({
				queryKey: playlistKeys.playlistLists(),
			})
		},
		onError: (error, { playlistId }) =>
			toastAndLogError(
				`${t('プレイリストの削除に失敗しました: playlistId=')}${playlistId}`,
				error,
				SCOPE,
			),
	})
}

export const useBatchDeleteTracksFromLocalPlaylist = () => {
	return useMutation({
		mutationKey: ['db', 'playlist', 'batchDeleteTracksFromLocalPlaylist'],
		mutationFn: async ({
			trackIds,
			playlistId,
		}: {
			trackIds: number[]
			playlistId: number
		}) => {
			const result = await playlistFacade.removeTracksFromPlaylist(
				playlistId,
				trackIds,
			)
			if (result.isErr()) {
				throw result.error
			}
			return result.value
		},
		onSuccess: async (data, variables) => {
			toast.success(t('削除しました'), {
				description:
					data.missingTrackIds.length !== 0
						? `${t('ただし、次の曲が見つかりませんでした: ')}${data.missingTrackIds.toString()}`
						: undefined,
			})
			const promises = [
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistLists(),
				}),
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistContents(variables.playlistId),
				}),
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistMetadata(variables.playlistId),
				}),
			]
			for (const id of data.removedTrackIds) {
				promises.push(
					queryClient.invalidateQueries({
						queryKey: playlistKeys.playlistsContainingTrack(id),
					}),
				)
			}
			await Promise.all(promises)
		},
		onError: (error) =>
			toastAndLogError(t('プレイリストから曲を削除できませんでした'), error, SCOPE),
	})
}

export const useCreateNewLocalPlaylist = () => {
	return useMutation({
		mutationKey: ['db', 'playlist', 'createNewLocalPlaylist'],
		mutationFn: async (payload: {
			title: string
			description?: string
			coverUrl?: string
		}) => {
			const result = await playlistService.createPlaylist({
				...payload,
				type: 'local',
			})
			if (result.isErr()) throw result.error
			return result.value
		},
		onSuccess: async (playlist) => {
			toast.success(t('プレイリストを作成しました'))
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistLists(),
				}),
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistContents(playlist.id),
				}),
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistMetadata(playlist.id),
				}),
			])
		},
		onError: (error) => toastAndLogError(t('プレイリストの作成に失敗しました'), error, SCOPE),
	})
}

export const useMergePlaylists = () => {
	return useMutation({
		mutationKey: ['db', 'playlist', 'mergePlaylists'],
		mutationFn: async ({
			sourcePlaylistIds,
			title,
		}: {
			sourcePlaylistIds: number[]
			title: string
		}) => {
			const result = await playlistFacade.mergePlaylists(
				sourcePlaylistIds,
				title,
			)
			if (result.isErr()) throw result.error
			return result.value
		},
		onSuccess: async (newPlaylistId) => {
			toast.success(t('動的マージプレイリストを作成しました'))
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistLists(),
				}),
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistContents(newPlaylistId),
				}),
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistMetadata(newPlaylistId),
				}),
			])
		},
		onError: (error) => toastAndLogError(t('動的マージプレイリストの作成に失敗しました'), error, SCOPE),
	})
}

export const useReorderLocalPlaylistTrack = () => {
	return useMutation({
		mutationKey: ['db', 'playlist', 'reorderLocalPlaylistTrack'],
		mutationFn: async ({
			playlistId,
			trackId,
			prevSortKey,
			nextSortKey,
		}: {
			playlistId: number
			trackId: number
			prevSortKey: string | null
			nextSortKey: string | null
		}) => {
			const result = await playlistFacade.reorderLocalPlaylistTrack(
				playlistId,
				{
					trackId,
					prevSortKey,
					nextSortKey,
				},
			)
			if (result.isErr()) throw result.error
			return result.value
		},
		onSuccess: async (_, { playlistId }) => {
			await queryClient.invalidateQueries({
				queryKey: playlistKeys.playlistContents(playlistId),
			})
		},
		onError: (error) => toastAndLogError(t('曲の並べ替えに失敗しました'), error, SCOPE),
	})
}

/**
 * 批量添加 tracks 到本地播放列表
 * @param playlistId
 * @param payloads 应包含 track 和 artist，**artist 只能为 remote 来源**
 * @returns
 */
export const useBatchAddTracksToLocalPlaylist = () => {
	return useMutation({
		mutationKey: ['db', 'playlist', 'batchAddTracksToLocalPlaylist'],
		mutationFn: async ({
			playlistId,
			payloads,
		}: {
			playlistId: number
			payloads: { track: CreateTrackPayload; artist: CreateArtistPayload }[]
		}) => {
			const result = await playlistFacade.batchAddTracksToLocalPlaylist(
				playlistId,
				payloads,
			)
			if (result.isErr()) throw result.error
			return result.value
		},
		onSuccess: async (trackIds, { playlistId }) => {
			toast.success(t('追加しました'))
			const promises = [
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistLists(),
				}),
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistContents(playlistId),
				}),
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistMetadata(playlistId),
				}),
			]
			for (const id of trackIds) {
				promises.push(
					queryClient.invalidateQueries({
						queryKey: playlistKeys.playlistsContainingTrack(id),
					}),
				)
			}
			await Promise.all(promises)
		},
		onError: (error) =>
			toastAndLogError(t('曲をまとめてプレイリストに追加できませんでした'), error, SCOPE),
	})
}
