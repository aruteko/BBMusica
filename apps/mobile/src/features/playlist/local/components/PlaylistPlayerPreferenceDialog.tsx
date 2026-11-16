import { useMutation } from '@tanstack/react-query'
import { Dialog, Portal, RadioButton, Text } from 'react-native-paper'

import Button from '@/components/common/Button'
import { playlistKeys } from '@/hooks/queries/db/playlist'
import useAppStore from '@/hooks/stores/useAppStore'
import { queryClient } from '@/lib/config/queryClient'
import { playlistService } from '@/lib/services/playlistService'
import type { Playlist } from '@/types/core/media'
import { toastAndLogError } from '@/utils/error-handling'
import { t } from '@/i18n'

export function PlaylistPlayerPreferenceDialog({
	playlist,
	visible,
	onDismiss,
}: {
	playlist: Playlist
	visible: boolean
	onDismiss: () => void
}) {
	const defaultMode = useAppStore((state) => state.settings.defaultPlayerMode)
	const mutation = useMutation({
		networkMode: 'always',
		mutationFn: async (preference: Playlist['playerPreference']) => {
			const result = await playlistService.setPlayerPreference(
				playlist.id,
				preference,
			)
			if (result.isErr()) throw result.error
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: playlistKeys.all })
			onDismiss()
		},
		onError: (error) =>
			toastAndLogError(
				t('プレーヤー設定の保存に失敗しました'),
				error,
				'Playlist.PlayerPreference',
			),
	})
	return (
		<Portal>
			<Dialog
				visible={visible}
				onDismiss={onDismiss}
			>
				<Dialog.Title>{t('プレーヤー設定')}</Dialog.Title>
				<Dialog.Content>
					<Text variant='bodyMedium'>{t('次の再生から適用されます')}</Text>
					<RadioButton.Group
						value={playlist.playerPreference}
						onValueChange={(value) => {
							if (
								value === 'inherit' ||
								value === 'music' ||
								value === 'podcast'
							)
								mutation.mutate(value)
						}}
					>
						<RadioButton.Item
							disabled={mutation.isPending}
							label={t('グローバル設定に従う · {0}', defaultMode === 'podcast' ? t('ポッドキャスト') : t('音楽'))}
							value='inherit'
						/>
						<RadioButton.Item
							disabled={mutation.isPending}
							label={t('音楽')}
							value='music'
						/>
						<RadioButton.Item
							disabled={mutation.isPending}
							label={t('ポッドキャスト')}
							value='podcast'
						/>
					</RadioButton.Group>
				</Dialog.Content>
				<Dialog.Actions>
					<Button onPress={onDismiss}>{t('キャンセル')}</Button>
				</Dialog.Actions>
			</Dialog>
		</Portal>
	)
}
