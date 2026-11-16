import { ServiceError } from './index'
import { t } from '@/i18n'
export type ServiceErrorType =
	| 'TrackNotFound'
	| 'ArtistNotFound'
	| 'PlaylistNotFound'
	| 'PlaylistAlreadyExists'
	| 'TrackNotInPlaylist'
	| 'ArtistAlreadyExists'
	| 'Validation'
	| 'NotImplemented'
	| 'FetchDownloadUrlFailed'
	| 'DeleteDownloadRecordFailed'
	| 'SkinFetchFailed'
	| 'SkinValidationFailed'
	| 'SkinDownloadFailed'
	| 'SkinTransformFailed'
	| 'SkinInstallFailed'
	| 'SkinUninstallFailed'
	| 'SkinNotFound'

export function createServiceError(
	type: ServiceErrorType,
	message: string,
	options?: { data?: unknown; cause?: unknown },
) {
	return new ServiceError(message, {
		type,
		data: options?.data,
		cause: options?.cause,
	})
}

export function createTrackNotFound(trackId: number | string, cause?: unknown) {
	return createServiceError('TrackNotFound', `${t('track が見つかりません: ')}${trackId}`, {
		data: { trackId },
		cause,
	})
}

export function createArtistNotFound(
	artistId: number | string,
	cause?: unknown,
) {
	return createServiceError('ArtistNotFound', `${t('artist が見つかりません: ')}${artistId}`, {
		data: { artistId },
		cause,
	})
}

export function createPlaylistNotFound(
	playlistId: number | string,
	cause?: unknown,
) {
	return createServiceError(
		'PlaylistNotFound',
		`${t('プレイリストが見つかりません: ')}${playlistId}`,
		{ data: { playlistId }, cause },
	)
}

export function createTrackNotInPlaylist(
	trackId: number | string,
	playlistId: number | string,
	cause?: unknown,
) {
	return createServiceError(
		'TrackNotInPlaylist',
		`track ${trackId}${t(' は次のプレイリストにありません: ')}${playlistId}`,
		{
			data: { trackId, playlistId },
			cause,
		},
	)
}

export function createValidationError(
	message = t('パラメーターが無効です'),
	cause?: unknown,
) {
	return createServiceError('Validation', message, { cause })
}

export function createNotImplementedError(message = t('未実装です'), cause?: unknown) {
	return createServiceError('NotImplemented', message, { cause })
}

export function createPlaylistAlreadyExists(title: string, cause?: unknown) {
	return createServiceError(
		'PlaylistAlreadyExists',
		`${t('プレイリスト「')}${title}${t('」はすでにあります')}`,
		{
			data: { title },
			cause,
		},
	)
}

export { DatabaseError } from './index'

export function createSkinFetchFailed(
	message = t('テーマ素材を取得できませんでした'),
	cause?: unknown,
) {
	return createServiceError('SkinFetchFailed', message, { cause })
}

export function createSkinValidationFailed(
	message = t('テーマのデータが無効です'),
	cause?: unknown,
) {
	return createServiceError('SkinValidationFailed', message, { cause })
}

export function createSkinDownloadFailed(
	message = t('テーマ素材をダウンロードできませんでした'),
	cause?: unknown,
) {
	return createServiceError('SkinDownloadFailed', message, { cause })
}

export function createSkinTransformFailed(
	message = t('テーマ素材を変換できませんでした'),
	cause?: unknown,
) {
	return createServiceError('SkinTransformFailed', message, { cause })
}

export function createSkinInstallFailed(
	message = t('テーマをインストールできませんでした'),
	cause?: unknown,
) {
	return createServiceError('SkinInstallFailed', message, { cause })
}

export function createSkinUninstallFailed(
	message = t('テーマをアンインストールできませんでした'),
	cause?: unknown,
) {
	return createServiceError('SkinUninstallFailed', message, { cause })
}

export function createSkinNotFound(skinId: string, cause?: unknown) {
	return createServiceError('SkinNotFound', `${t('テーマが見つかりません: ')}${skinId}`, {
		data: { skinId },
		cause,
	})
}
