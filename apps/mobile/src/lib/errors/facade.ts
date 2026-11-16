import { FacadeError as BaseFacadeError } from '.'
import { t } from '@/i18n'

export type FacadeErrorType =
	| 'SyncTaskAlreadyRunning'
	| 'SyncCollectionFailed'
	| 'SyncSeriesFailed'
	| 'SyncMultiPageFailed'
	| 'SyncFavoriteFailed'
	| 'fetchRemotePlaylistMetadataFailed'
	| 'PlaylistDuplicateFailed'
	| 'UpdateTrackLocalPlaylistsFailed'
	| 'BatchAddTracksToLocalPlaylistFailed'
	| 'PlaylistCreateFailed'
	| 'PlaylistMergeFailed'
	| 'SavePlaylistFailed'
	| 'RemoveTracksFromPlaylistFailed'
	| 'ReorderPlaylistTrackFailed'
	| 'UpdatePlaylistMetadataFailed'
	| 'PlaylistPermissionDenied'
	| 'PlaylistDeleteFailed'
	| 'InviteCodeRotateFailed'
	| 'InviteCodeFetchFailed'

export class FacadeError extends BaseFacadeError {
	constructor(
		message: string,
		opts?: { type?: FacadeErrorType; data?: unknown; cause?: unknown },
	) {
		super(message, { type: opts?.type, data: opts?.data, cause: opts?.cause })
	}
}

export function createSyncTaskAlreadyRunningError(cause?: unknown) {
	return new FacadeError(t('同期中です。しばらくしてからお試しください'), {
		type: 'SyncTaskAlreadyRunning',
		cause,
	})
}

export function createFacadeError(
	type: FacadeErrorType,
	message: string,
	options?: { data?: unknown; cause?: unknown },
) {
	return new FacadeError(message, {
		type,
		data: options?.data,
		cause: options?.cause,
	})
}
