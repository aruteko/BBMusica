import { Orpheus, type Track as OrpheusTrack } from '@bbplayer/orpheus'
import type { Result } from 'neverthrow'
import { create } from 'zustand'

import { ServiceError } from '@/lib/errors'
import { trackService } from '@/lib/services/trackService'
import type { Track } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'
import log from '@/utils/log'
import { t } from '@/i18n'

const logger = log.extend('Store.Player')

/**
 * 队列里的曲目可能还没有录入本地数据库（例如旧版本遗留的播放队列）。
 * 对 B 站曲目，从 B 站接口取回信息并录入，再继续使用；其它情况返回 undefined。
 */
async function recoverMissingBilibiliTrack(
	uniqueKey: string,
): Promise<Result<Track, unknown> | undefined> {
	const [source, bvid, cid] = uniqueKey.split('::')
	if (source !== 'bilibili' || !bvid) return undefined
	// 动态 import：避免 store 与 facade 之间产生循环依赖
	const { syncFacade } = await import('@/lib/facades/syncBilibiliPlaylist')
	const parsedCid = cid ? Number(cid) : undefined
	return syncFacade.addTrackFromBilibiliApi(
		bvid,
		parsedCid !== undefined && !Number.isNaN(parsedCid) ? parsedCid : undefined,
	)
}
let syncRevision = 0
let initialized = false

interface PlayerState {
	orpheusTrack: OrpheusTrack | null
	internalTrack: Track | null
	currentIndex: number

	initialize: () => void
	sync: () => Promise<void>
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
	orpheusTrack: null,
	internalTrack: null,
	currentIndex: -1,

	initialize: () => {
		if (initialized) return
		initialized = true
		void get().sync()

		Orpheus.addListener('onTrackStarted', async () => {
			await get().sync()
		})
		Orpheus.addListener('onQueueChanged', async () => {
			await get().sync()
		})
	},

	sync: async () => {
		const revision = ++syncRevision
		try {
			const [currentTrack, currentIndex] = await Promise.all([
				Orpheus.getCurrentTrack(),
				Orpheus.getCurrentIndex(),
			])

			if (revision !== syncRevision) return
			const currentInternalTrackId = get().internalTrack?.uniqueKey
			const newTrackId = currentTrack?.id

			set({ orpheusTrack: currentTrack, currentIndex })

			if (!currentTrack) {
				set({ internalTrack: null })
				return
			}

			if (newTrackId !== currentInternalTrackId) {
				let result: Result<Track, unknown> =
					await trackService.getTrackByUniqueKey(currentTrack.id)
				if (
					result.isErr() &&
					result.error instanceof ServiceError &&
					result.error.type === 'TrackNotFound'
				) {
					const recovered = await recoverMissingBilibiliTrack(currentTrack.id)
					if (recovered) result = recovered
				}

				if (revision !== syncRevision || get().orpheusTrack?.id !== newTrackId)
					return

				if (result.isErr()) {
					set({ internalTrack: null })
					toastAndLogError(t('現在の曲情報の取得に失敗しました'), result.error, 'Store.Player')
					return
				}
				set({ internalTrack: result.value })
			}
		} catch (e) {
			logger.warning('Failed to sync player state', { error: e })
		}
	},
}))

export default usePlayerStore
