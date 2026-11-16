import { expoDb } from '@/lib/db/db'
import log from '@/utils/log'
import { storage } from '@/utils/mmkv'

import { DataMigration } from './state'

const logger = log.extend('migrateAccountRemoved')
const migration = new DataMigration(
	'account_removed_v1',
	'account_removed_migrated_v1',
)

/**
 * BBMusicaアカウントとクラウド共有を廃止したので、共有プレイリストの状態を消す。
 * プレイリストの中身は残り、ふつうのローカルプレイリストとして使える。
 */
export function migrateAccountRemoved(): void {
	if (migration.isApplied()) return

	try {
		expoDb.withTransactionSync(() => {
			expoDb.runSync(
				`UPDATE playlists
				 SET share_id = NULL,
					 share_role = NULL,
					 last_share_sync_at = NULL
				 WHERE share_id IS NOT NULL
					OR share_role IS NOT NULL
					OR last_share_sync_at IS NOT NULL`,
			)
			expoDb.runSync(`DELETE FROM playlist_sync_queue`)
			migration.markAsApplied()
		})

		storage.remove('shared-playlist-members')
		storage.remove('bbplayer_jwt')
		logger.info('共有プレイリストの状態と同期キューを消去しました')
	} catch (error) {
		logger.error('共有プレイリストの状態を消去できませんでした:', error)
	}
}
