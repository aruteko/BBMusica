import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'expo-router'

import { playlistKeys } from '@/hooks/queries/db/playlist'
import { ensureBBPlayerToken } from '@/lib/api/bbplayer/client'
import { queryClient } from '@/lib/config/queryClient'
import { CustomError } from '@/lib/errors'
import { playlistFacade } from '@/lib/facades/playlist'
import { sharedPlaylistFacade } from '@/lib/facades/sharedPlaylist'
import type { PlaylistSyncProgress } from '@/lib/facades/syncBilibiliPlaylist'
import { syncFacade } from '@/lib/facades/syncBilibiliPlaylist'
import { playlistService } from '@/lib/services/playlistService'
import type { Playlist } from '@/types/core/media'
import type { CreateArtistPayload } from '@/types/services/artist'
import type { UpdatePlaylistPayload } from '@/types/services/playlist'
import type { CreateTrackPayload } from '@/types/services/track'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'

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
			toast.success('同期しました', { id: toastId })
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
				`プレイリストの同期に失敗しました: remoteSyncId=${remoteSyncId}, type=${type}`,
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
			toast.success('操作しました')
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
				`曲のプレイリスト登録の操作に失敗しました: trackTitle=${trackPayload.title}`,
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
			toast.success('複製しました')
			await queryClient.invalidateQueries({
				queryKey: playlistKeys.playlistLists(),
			})
		},
		onError: (error, { playlistId, name }) =>
			toastAndLogError(
				`プレイリストを複製失败: playlistId=${playlistId}, name=${name}`,
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
			toast.success('操作しました')
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
				`プレイリスト情報の変更に失敗しました：playlistId=${playlistId}`,
				error,
				SCOPE,
			),
	})
}

export const useDeletePlaylist = () => {
	return useMutation({
		mutationKey: ['db', 'playlist', 'deletePlaylist'],
		mutationFn: async ({ playlistId }: { playlistId: number }) => {
			// 共享歌单需要有效 token；本地歌单无需，若获取失败静默忽略
			try {
				await ensureBBPlayerToken()
			} catch {
				// local 歌单不需要 token，继续执行
			}
			const result = await playlistFacade.deletePlaylist(playlistId)
			if (result.isErr()) {
				throw result.error
			}
			return result.value
		},
		onSuccess: (_, { playlistId }) => {
			toast.success('削除しました')
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
				`プレイリストの削除に失敗しました: playlistId=${playlistId}`,
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
			toast.success('削除しました', {
				description:
					data.missingTrackIds.length !== 0
						? `ただし、次の曲が見つかりませんでした: ${data.missingTrackIds.toString()}`
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
			toastAndLogError('プレイリストから曲を削除できませんでした', error, SCOPE),
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
			toast.success('プレイリストを作成しました')
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
		onError: (error) => toastAndLogError('プレイリストの作成に失敗しました', error, SCOPE),
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
			toast.success('動的マージプレイリストを作成しました')
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
		onError: (error) => toastAndLogError('動的マージプレイリストの作成に失敗しました', error, SCOPE),
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
		onError: (error) => toastAndLogError('曲の並べ替えに失敗しました', error, SCOPE),
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
			toast.success('追加しました')
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
			toastAndLogError('曲をまとめてプレイリストに追加できませんでした', error, SCOPE),
	})
}

/**
 * 将本地歌单升级为共享歌单（启用分享）
 */
export const useEnableSharing = () => {
	return useMutation({
		mutationKey: ['db', 'playlist', 'enableSharing'],
		mutationFn: async ({ playlistId }: { playlistId: number }) => {
			await ensureBBPlayerToken()
			const result = await sharedPlaylistFacade.enableSharing(playlistId)
			if (result.isErr()) {
				throw result.error
			}
			return result.value
		},
		onSuccess: async (_, { playlistId }) => {
			toast.success('共有をオンにしました')
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistLists(),
				}),
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistMetadata(playlistId),
				}),
			])
		},
		onError: (error) => toastAndLogError('共有プレイリストの有効化に失敗しました', error, SCOPE),
	})
}

/**
 * 通过 shareId 订阅一个共享歌单
 */
export const useSubscribeToSharedPlaylist = () => {
	const router = useRouter()
	return useMutation({
		mutationKey: ['db', 'playlist', 'subscribeToSharedPlaylist'],
		mutationFn: async ({
			shareId,
			inviteCode,
		}: {
			shareId: string
			inviteCode?: string
		}) => {
			await ensureBBPlayerToken()
			const result = await sharedPlaylistFacade.subscribeToPlaylist({
				shareId,
				inviteCode,
			})
			if (result.isErr()) throw result.error
			return result.value
		},
		onSuccess: async ({ localPlaylistId }) => {
			toast.success('購読しました')
			await queryClient.invalidateQueries({
				queryKey: playlistKeys.playlistLists(),
			})
			router.navigate({
				pathname: '/playlist/local/[id]',
				params: { id: String(localPlaylistId) },
			})
		},
		onError: (error) => toastAndLogError('共有プレイリストの購読に失敗しました', error, SCOPE),
	})
}

/**
 * 拉取共享歌单的增量变更
 */
export const usePullSharedPlaylist = () => {
	return useMutation({
		mutationKey: ['db', 'playlist', 'pullSharedPlaylist'],
		mutationFn: async ({ playlistId }: { playlistId: number }) => {
			await ensureBBPlayerToken()
			const result = await sharedPlaylistFacade.pullChanges(playlistId)
			if (result.isErr()) throw result.error
			return result.value
		},
		onSuccess: async (_, { playlistId }) => {
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistContents(playlistId),
				}),
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistMetadata(playlistId),
				}),
				queryClient.invalidateQueries({
					queryKey: playlistKeys.playlistLists(),
				}),
			])
		},
		onError: (error, { playlistId }) => {
			if (
				error instanceof CustomError &&
				error.type === 'SharedPlaylistDeleted'
			) {
				// 交由调用方处理删除逻辑，这里静默
				return
			}
			toastAndLogError(
				`共有プレイリストの取得に失敗しました: playlistId=${playlistId}`,
				error,
				SCOPE,
			)
		},
	})
}

export const useRotateEditorInviteCode = () => {
	return useMutation({
		mutationKey: ['db', 'playlist', 'editorInvite', 'rotate'],
		mutationFn: async ({ shareId }: { shareId: string }) => {
			const result = await sharedPlaylistFacade.rotateEditorInviteCode(shareId)
			if (result.isErr()) throw result.error
			return result.value
		},
		onSuccess: async (data, { shareId }) => {
			await queryClient.invalidateQueries({
				queryKey: playlistKeys.editorInviteCode(shareId),
			})
			return data
		},
		onError: (error) => toastAndLogError('編集者の招待コードの作成に失敗しました', error, SCOPE),
	})
}
