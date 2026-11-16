import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'
import { ResultAsync, errAsync } from 'neverthrow'

import defaultDb from '@/lib/db/db'
import * as schema from '@/lib/db/schema'
import { createFacadeError } from '@/lib/errors/facade'
import { createValidationError } from '@/lib/errors/service'
import { artistService as artistServiceInstance, type ArtistService } from '@/lib/services/artistService'
import {
	playlistService as playlistServiceInstance,
	type PlaylistService,
} from '@/lib/services/playlistService'
import { trackService as trackServiceInstance, type TrackService } from '@/lib/services/trackService'
import type { CreateArtistPayload } from '@/types/services/artist'
import type {
	ReorderLocalPlaylistTrackPayload,
	UpdatePlaylistPayload,
} from '@/types/services/playlist'
import type { CreateTrackPayload } from '@/types/services/track'
import log from '@/utils/log'
import { t as tr } from '@/i18n'

const logger = log.extend('Facade')

export class PlaylistFacade {
	constructor(
		private readonly trackService: TrackService,
		private readonly playlistService: PlaylistService,
		private readonly artistService: ArtistService,
		private readonly db: ExpoSQLiteDatabase<typeof schema>,
	) {}

	/**
	 * 复制一份 playlist，新复制的 playlist 类型为 local，且 author&remoteSyncId 为 null
	 * @param playlistId remote playlist 的 ID
	 * @param name 新的 local playlist 的名称
	 * @returns 如果成功，则为 local playlist 的 ID
	 */
	public async duplicatePlaylist(playlistId: number, name: string) {
		logger.info('开始复制播放列表', { playlistId, name })
		return ResultAsync.fromPromise(
			this.db.transaction(async (tx) => {
				const playlistSvc = this.playlistService.withDB(tx)

				const playlist = await playlistSvc.getPlaylistById(playlistId)
				if (playlist.isErr()) {
					throw playlist.error
				}
				const playlistMetadata = playlist.value

				if (!playlistMetadata)
					throw createValidationError(`${tr('プレイリストが見つかりません：')}${playlistId}`)

				logger.debug('step1: 获取播放列表', playlistMetadata.id)

				const localPlaylistResult = await playlistSvc.createPlaylist({
					title: name,
					description: playlistMetadata.description,
					coverUrl: playlistMetadata.coverUrl,
					authorId: null,
					type: 'local',
					remoteSyncId: null,
				})
				if (localPlaylistResult.isErr()) {
					throw localPlaylistResult.error
				}
				const localPlaylist = localPlaylistResult.value
				logger.debug('step2: 创建本地播放列表', localPlaylist)
				logger.info('创建本地播放列表成功', {
					localPlaylistId: localPlaylist.id,
				})

				const tracksMetadata = await playlistSvc.getPlaylistTracks(playlistId)
				if (tracksMetadata.isErr()) {
					throw tracksMetadata.error
				}
				const finalIds = tracksMetadata.value
					.filter((t) => {
						if (t.source === 'bilibili' && !t.bilibiliMetadata.videoIsValid)
							return false
						return true
					})
					.map((t) => t.id)
				logger.debug(
					'step3: プレイリスト内のすべての曲を取得し、整理しました（Bilibiliの音声は無効な動画を除外）',
				)

				const replaceResult = await playlistSvc.replacePlaylistAllTracks(
					localPlaylist.id,
					finalIds,
				)
				if (replaceResult.isErr()) {
					throw replaceResult.error
				}
				logger.debug('step4: 替换本地播放列表中的所有歌曲')
				logger.info('复制播放列表成功', {
					sourcePlaylistId: playlistId,
					targetPlaylistId: localPlaylist.id,
					trackCount: finalIds.length,
				})

				return localPlaylist.id
			}),
			(e) =>
				createFacadeError('PlaylistDuplicateFailed', tr('プレイリストを複製できませんでした'), {
					cause: e,
				}),
		)
	}

	/**
	 * 创建动态合并歌单，读取时从源歌单实时展开并自动去重。
	 */
	public async mergePlaylists(sourcePlaylistIds: number[], title: string) {
		logger.info('开始创建动态合并播放列表', { sourcePlaylistIds, title })
		return ResultAsync.fromPromise(
			this.db.transaction(async (tx) => {
				const playlistSvc = this.playlistService.withDB(tx)

				const uniqueSourceIds = Array.from(new Set(sourcePlaylistIds))
				if (uniqueSourceIds.length < 2) {
					throw createValidationError(
						tr('元のプレイリストを2つ以上選んでください'),
					)
				}

				for (const playlistId of uniqueSourceIds) {
					const playlist = await playlistSvc.getPlaylistById(playlistId)
					if (playlist.isErr()) throw playlist.error
					if (!playlist.value) {
						throw createValidationError(`${tr('プレイリストが見つかりません：')}${playlistId}`)
					}
					if (playlist.value.type === 'dynamic') {
						throw createValidationError(tr('動的マージプレイリストは元にできません'))
					}
				}

				const newPlaylistRes = await playlistSvc.createPlaylist({
					title,
					description: tr('動的マージプレイリスト'),
					type: 'dynamic',
					authorId: null,
					remoteSyncId: null,
				})
				if (newPlaylistRes.isErr()) throw newPlaylistRes.error
				const newPlaylist = newPlaylistRes.value

				await tx.insert(schema.dynamicPlaylistSources).values(
					uniqueSourceIds.map((sourcePlaylistId, position) => ({
						playlistId: newPlaylist.id,
						sourcePlaylistId,
						position,
					})),
				)

				logger.info('创建动态合并播放列表成功', {
					sourcePlaylistIds: uniqueSourceIds,
					newPlaylistId: newPlaylist.id,
				})

				return newPlaylist.id
			}),
			(e) =>
				createFacadeError('PlaylistMergeFailed', tr('作成动态合并播放列表失败'), {
					cause: e,
				}),
		)
	}

	/**
	 * 更新某个 Track 在本地播放列表中的归属。
	 * - 如需要会自动创建 Artist，并把其 id 关联到 Track。
	 * - 若 Track 不存在会自动创建。
	 * @returns 更新后的 Track 的 ID
	 */
	public async updateTrackLocalPlaylists(params: {
		toAddPlaylistIds: number[]
		toRemovePlaylistIds: number[]
		trackPayload: CreateTrackPayload
		artistPayload?: CreateArtistPayload | null
	}) {
		const {
			toAddPlaylistIds,
			toRemovePlaylistIds,
			trackPayload,
			artistPayload,
		} = params

		logger.info('开始更新 Track 在本地播放列表', {
			toAdd: toAddPlaylistIds.length,
			toRemove: toRemovePlaylistIds.length,
			source: trackPayload.source,
			title: trackPayload.title,
		})
		return ResultAsync.fromPromise(
			this.db.transaction(async (tx) => {
				const playlistSvc = this.playlistService.withDB(tx)
				const trackSvc = this.trackService.withDB(tx)
				const artistSvc = this.artistService.withDB(tx)

				// step1: 解析/创建 Artist（如需要）
				let finalArtistId: number | undefined =
					trackPayload.artistId ?? undefined
				if (finalArtistId === undefined && artistPayload) {
					const artistIdRes = await artistSvc.findOrCreateArtist(artistPayload)
					if (artistIdRes.isErr()) throw artistIdRes.error
					finalArtistId = artistIdRes.value.id
				}
				logger.debug('step1: 解析/创建 Artist 完成', finalArtistId ?? '(无)')

				// step2: 解析/创建 Track
				const trackRes = await trackSvc.findOrCreateTrack({
					...trackPayload,
					artistId: finalArtistId ?? undefined,
				})
				if (trackRes.isErr()) throw trackRes.error
				const trackId = trackRes.value.id
				logger.debug('step2: 解析/创建 Track 完成', trackId)

				// step3: 执行增删
				for (const pid of toAddPlaylistIds) {
					// oxlint-disable-next-line no-await-in-loop
					const r = await playlistSvc.addManyTracksToLocalPlaylist(pid, [
						trackId,
					])
					if (r.isErr()) throw r.error

				}
				for (const pid of toRemovePlaylistIds) {
					// oxlint-disable-next-line no-await-in-loop
					const r = await playlistSvc.batchRemoveTracksFromLocalPlaylist(pid, [
						trackId,
					])
					if (r.isErr()) throw r.error

				}
				logger.debug('step3: 更新本地播放列表完成', {
					added: toAddPlaylistIds,
					removed: toRemovePlaylistIds,
				})

				logger.debug('更新 Track 在本地播放列表成功')
				logger.info('更新 Track 在本地播放列表成功', {
					trackId,
					added: toAddPlaylistIds.length,
					removed: toRemovePlaylistIds.length,
				})
				return trackId
			}),
			(e) =>
				createFacadeError(
					'UpdateTrackLocalPlaylistsFailed',
					tr('ローカルのプレイリスト内の曲の更新に失敗しました'),
					{ cause: e },
				),
		)
	}

	/**
	 * 批量添加 tracks 到本地播放列表。
	 * @param playlistId
	 * @param payloads 应包含 track 和 artist，**artist 只能为 remote 来源**
	 */
	public async batchAddTracksToLocalPlaylist(
		playlistId: number,
		payloads: { track: CreateTrackPayload; artist: CreateArtistPayload }[],
	) {
		logger.info('开始批量添加 tracks 到本地播放列表', {
			playlistId,
			count: payloads.length,
		})
		for (const payload of payloads) {
			if (payload.artist.source === 'local') {
				return errAsync(
					createValidationError(
						tr('アーティストはリモート由来のものだけ指定できます'),
					),
				)
			}
		}
		return ResultAsync.fromPromise(
			this.db.transaction(async (tx) => {
				const playlistSvc = this.playlistService.withDB(tx)
				const trackSvc = this.trackService.withDB(tx)
				const artistSvc = this.artistService.withDB(tx)


				const artistResult = await artistSvc.findOrCreateManyRemoteArtists(
					payloads.map((p) => p.artist),
				)
				if (artistResult.isErr()) throw artistResult.error
				const artistMap = artistResult.value
				logger.debug('step1: 批量创建 artist 完成')

				const trackResult = await trackSvc.findOrCreateManyTracks(
					payloads.map((p) => ({
						...p.track,
						artistId: artistMap.get(p.artist.remoteId!)?.id,
					})),
					'bilibili',
				)
				if (trackResult.isErr()) throw trackResult.error
				const trackIds = Array.from(trackResult.value.values())
				logger.debug('step2: 批量创建 track 完成')

				const addResult = await playlistSvc.addManyTracksToLocalPlaylist(
					playlistId,
					trackIds,
				)
				if (addResult.isErr()) throw addResult.error
				logger.debug('step3: 批量将 track 添加到本地播放列表完成')


				logger.info('批量添加 tracks 到本地播放列表成功', {
					playlistId,
					added: trackIds.length,
				})
				return trackIds
			}),
			(e) =>
				createFacadeError(
					'BatchAddTracksToLocalPlaylistFailed',
					tr('曲をまとめてローカルのプレイリストに追加できませんでした'),
					{ cause: e },
				),
		)
	}

	/**
	 * 将播放队列保存为新的播放列表
	 * @param name 播放列表名称
	 * @param uniqueKeys 队列中的 track uniqueKeys
	 */
	public async saveQueueAsPlaylist(name: string, uniqueKeys: string[]) {
		logger.info('开始将队列保存为播放列表', {
			name,
			trackCount: uniqueKeys.length,
		})
		return ResultAsync.fromPromise(
			this.db.transaction(async (tx) => {
				const playlistSvc = this.playlistService.withDB(tx)
				const trackSvc = this.trackService.withDB(tx)

				// 1. 创建播放列表
				const playlistRes = await playlistSvc.createPlaylist({
					title: name,
					type: 'local',
					authorId: null,
					remoteSyncId: null,
				})
				if (playlistRes.isErr()) throw playlistRes.error
				const playlist = playlistRes.value

				// 2. 验证所有 tracks 在本地存在，并获取 ID
				const distinctKeys = Array.from(new Set(uniqueKeys))

				const findRes = await trackSvc.findTrackIdsByUniqueKeys(distinctKeys)
				if (findRes.isErr()) throw findRes.error
				const foundMap = findRes.value

				const trackIds: number[] = []
				for (const key of distinctKeys) {
					const id = foundMap.get(key)
					if (id === undefined) {
						// 理论上不应该发生，因为进入播放队列的歌曲必须在本地 DB 有记录
						logger.error(`保存队列时发现缺失的 track: ${key}`)
						throw createFacadeError(
							'PlaylistCreateFailed',
							tr('キューを保存できません。未登録の曲: {0}', key),
						)
					}
					trackIds.push(id)
				}

				// 3. 批量添加到播放列表
				if (trackIds.length > 0) {
					const addRes = await playlistSvc.addManyTracksToLocalPlaylist(
						playlist.id,
						trackIds,
					)
					if (addRes.isErr()) throw addRes.error
				}

				return playlist.id
			}),
			(e) =>
				createFacadeError('PlaylistCreateFailed', tr('キューをプレイリストに保存できませんでした'), {
					cause: e,
				}),
		)
	}

	/**
	 * 从本地播放列表批量移除曲目。
	 */
	public async removeTracksFromPlaylist(
		playlistId: number,
		trackIds: number[],
	) {
		return ResultAsync.fromPromise(
			this.db.transaction(async (tx) => {
				const playlistSvc = this.playlistService.withDB(tx)


				const result = await playlistSvc.batchRemoveTracksFromLocalPlaylist(
					playlistId,
					trackIds,
				)
				if (result.isErr()) throw result.error


				return result.value
			}),
			(e) =>
				createFacadeError(
					'RemoveTracksFromPlaylistFailed',
					tr('プレイリストから曲を削除できませんでした'),
					{ cause: e },
				),
		)
	}

	/**
	 * 调整本地播放列表中单曲的位置。
	 */
	public async reorderLocalPlaylistTrack(
		playlistId: number,
		payload: ReorderLocalPlaylistTrackPayload,
	) {
		return ResultAsync.fromPromise(
			this.db.transaction(async (tx) => {
				const playlistSvc = this.playlistService.withDB(tx)


				const result = await playlistSvc.reorderSingleLocalPlaylistTrack(
					playlistId,
					payload,
				)
				if (result.isErr()) throw result.error


				return result.value
			}),
			(e) =>
				createFacadeError(
					'ReorderPlaylistTrackFailed',
					tr('プレイリスト内の曲順の変更に失敗しました'),
					{ cause: e },
				),
		)
	}

	/**
	 * 更新播放列表元数据（标题/描述/封面）。
	 */
	public async updatePlaylistMetadata(
		playlistId: number,
		payload: UpdatePlaylistPayload,
	) {
		return ResultAsync.fromPromise(
			this.db.transaction(async (tx) => {
				const playlistSvc = this.playlistService.withDB(tx)


				const result = await playlistSvc.updatePlaylistMetadata(
					playlistId,
					payload,
				)
				if (result.isErr()) throw result.error


				return result.value
			}),
			(e) =>
				createFacadeError(
					'UpdatePlaylistMetadataFailed',
					tr('プレイリスト情報の更新に失敗しました'),
					{ cause: e },
				),
		)
	}

	/**
	 * 删除播放列表（只删除本地数据）
	 */
	public async deletePlaylist(playlistId: number) {
		const playlistRes = await this.playlistService.getPlaylistById(playlistId)
		if (playlistRes.isErr()) {
			return errAsync(
				createFacadeError('PlaylistDeleteFailed', tr('プレイリストを読み込めませんでした'), {
					cause: playlistRes.error,
				}),
			)
		}
		const playlist = playlistRes.value
		if (!playlist) {
			return errAsync(
				createFacadeError(
					'PlaylistDeleteFailed',
					`${tr('プレイリストが見つかりません：')}${playlistId}`,
				),
			)
		}

		return this.playlistService
			.deletePlaylist(playlistId)
			.map(() => undefined)
			.mapErr((e) =>
				createFacadeError('PlaylistDeleteFailed', tr('プレイリストを削除できませんでした'), {
					cause: e,
				}),
			)
	}

}

export const playlistFacade = new PlaylistFacade(
	trackServiceInstance,
	playlistServiceInstance,
	artistServiceInstance,
	defaultDb,
)
