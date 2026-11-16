import { err, ok } from 'neverthrow'

import {
	bilibiliApi as bilibiliApiInstance,
	type bilibiliApi as BilibiliApiService,
} from '@/lib/api/bilibili/api'
import { av2bv } from '@/lib/api/bilibili/utils'
import { createFacadeError } from '@/lib/errors/facade'
import type { Playlist } from '@/types/core/media'
import { t } from '@/i18n'

export class BilibiliFacade {
	constructor(private readonly bilibiliApi: typeof BilibiliApiService) {}

	public async fetchRemotePlaylistMetadata(
		remoteId: number,
		type: Playlist['type'],
	) {
		switch (type) {
			case 'series': {
				const result = await this.bilibiliApi.getSeriesMetadata({
					seriesId: remoteId,
				})
				if (result.isErr()) {
					return err(
						createFacadeError(
							'fetchRemotePlaylistMetadataFailed',
							t('シリーズ情報の取得に失敗しました'),
							{ cause: result.error },
						),
					)
				}
				const firstPage = await this.bilibiliApi.getSeriesArchivesPage({
					seriesId: remoteId,
					mid: result.value.mid,
					pageNumber: 1,
				})
				if (firstPage.isErr()) {
					return err(
						createFacadeError(
							'fetchRemotePlaylistMetadataFailed',
							t('シリーズのカバーの取得に失敗しました'),
							{ cause: firstPage.error },
						),
					)
				}
				return ok({
					title: result.value.name,
					description: result.value.description,
					coverUrl: firstPage.value.archives?.[0]?.pic ?? '',
				})
			}
			case 'collection': {
				const result = await this.bilibiliApi.getCollectionAllContents({
					collectionId: remoteId,
				})
				if (result.isErr()) {
					return err(
						createFacadeError(
							'fetchRemotePlaylistMetadataFailed',
							t('コレクション情報の取得に失敗しました'),
							{ cause: result.error },
						),
					)
				}
				const metadata = result.value.info
				return ok({
					title: metadata.title,
					description: metadata.intro,
					coverUrl: metadata.cover,
				})
			}
			case 'multi_page': {
				const result = await this.bilibiliApi.getVideoDetails({
					bvid: av2bv(remoteId),
				})
				if (result.isErr()) {
					return err(
						createFacadeError(
							'fetchRemotePlaylistMetadataFailed',
							t('複数パートの動画情報の取得に失敗しました'),
							{ cause: result.error },
						),
					)
				}
				const metadata = result.value
				return ok({
					title: metadata.title,
					description: metadata.desc,
					coverUrl: metadata.pic,
				})
			}
			case 'favorite': {
				const result = await this.bilibiliApi.getFavoriteListContents({
					favoriteId: remoteId,
					pn: 1,
				})
				if (result.isErr()) {
					return err(
						createFacadeError(
							'fetchRemotePlaylistMetadataFailed',
							t('お気に入りの情報の取得に失敗しました'),
							{ cause: result.error },
						),
					)
				}
				const metadata = result.value.info
				if (!metadata) {
					return err(
						createFacadeError(
							'fetchRemotePlaylistMetadataFailed',
							t('お気に入りの情報を取得できません'),
						),
					)
				}
				return ok({
					title: metadata.title,
					description: metadata.intro,
					coverUrl: metadata.cover,
				})
			}
			default:
				return err(
					createFacadeError(
						'fetchRemotePlaylistMetadataFailed',
						`${t('プレイリスト情報の取得に失敗しました：不明なプレイリストの種類：')}${type}`,
					),
				)
		}
	}
}

export const bilibiliFacade = new BilibiliFacade(bilibiliApiInstance)
