import { Orpheus, type BilibiliCdnPreference } from '@bbplayer/orpheus'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import {
	Appbar,
	Button,
	List,
	RadioButton,
	Text,
	useTheme,
} from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import SettingsSectionTitle from '@/components/common/SettingsSectionTitle'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import {
	BILIBILI_CDN_OPTIONS,
	getCdnTestNodes,
	measureCdnSpeed,
	setPreferredBilibiliCdn,
	type BilibiliCdnNode,
} from '@/lib/services/bilibiliCdnService'
import { toastAndLogError } from '@/utils/error-handling'
import { t } from '@/i18n'

interface NodeResult {
	node: BilibiliCdnNode
	status: string
}

export default function CdnSettingsPage() {
	const router = useRouter()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const currentTrack = useCurrentTrack()
	const [preferred, setPreferred] = useState(Orpheus.preferredBilibiliCdn)
	const [running, setRunning] = useState(false)
	const [preparing, setPreparing] = useState(false)
	const [results, setResults] = useState<NodeResult[]>([])
	const [sampleName, setSampleName] = useState('')
	const operation = useRef<AbortController | null>(null)

	useEffect(
		() => () => {
			operation.current?.abort()
			operation.current = null
		},
		[],
	)

	const selectCdn = (value: string) => {
		const option = BILIBILI_CDN_OPTIONS.find((item) => item.id === value)
		if (!option) return
		try {
			setPreferredBilibiliCdn(option.id)
			setPreferred(option.id)
		} catch (error) {
			toastAndLogError(t('優先CDNの設定に失敗しました'), error, 'Settings.CDN')
		}
	}

	const cancel = () => {
		operation.current?.abort()
		operation.current = null
		setRunning(false)
		setPreparing(false)
		setResults((items) =>
			items.map((item) => ({
				...item,
				status:
					item.status === t('速度テスト待ち') ||
					item.status === t('速度テスト中…')
						? t('キャンセルしました')
						: item.status,
			})),
		)
	}

	const start = async () => {
		if (operation.current) return
		const controller = new AbortController()
		operation.current = controller
		const active = () =>
			operation.current === controller && !controller.signal.aborted
		setRunning(true)
		setPreparing(true)
		setResults([])
		const track = currentTrack?.source === 'bilibili' ? currentTrack : null
		setSampleName(track?.title ?? t('プリセット動画 BV1fK4y1t7hj'))
		try {
			const nodes = await getCdnTestNodes(track, controller.signal)
			if (!active()) return
			setPreparing(false)
			setResults(nodes.map((node) => ({ node, status: t('速度テスト待ち') })))
			for (const node of nodes) {
				if (!active()) break
				const update = (status: string) => {
					if (!active()) return
					setResults((items) =>
						items.map((item) =>
							item.node.host === node.host ? { ...item, status } : item,
						),
					)
				}
				update(t('速度テスト中…'))
				try {
					const result = await measureCdnSpeed(node.url, controller.signal)
					update(
						`${result.megabytesPerSecond.toFixed(2)}${t(' MB/s · 応答 ')}${Math.round(result.latencyMs)} ms`,
					)
				} catch (error) {
					update(error instanceof Error ? error.message : t('速度テストに失敗しました'))
				}
			}
		} catch (error) {
			if (active()) toastAndLogError(t('テスト用ノードの取得に失敗しました'), error, 'Settings.CDN')
		} finally {
			if (operation.current === controller) {
				operation.current = null
				setRunning(false)
				setPreparing(false)
			}
		}
	}

	const availability = (id: BilibiliCdnPreference) => {
		if (id === 'auto' || !results.length) return undefined
		return results.some(({ node }) => node.provider === id)
			? undefined
			: t('今回はこのCDNノードが返されませんでした')
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title={t('CDN設定')} />
			</Appbar.Header>
			<ScrollView
				contentContainerStyle={[
					styles.content,
					{ paddingBottom: insets.bottom + (currentTrack ? 100 : 24) },
				]}
			>
				<SettingsSectionTitle
					title={t('優先CDN')}
					first
				/>
				<Text
					variant='bodySmall'
					style={{ color: colors.onSurfaceVariant }}
				>{t('選んだ事業者を優先して使います')}</Text>
				<RadioButton.Group
					onValueChange={selectCdn}
					value={preferred}
				>
					{BILIBILI_CDN_OPTIONS.map((option) => (
						<List.Item
							key={option.id}
							title={option.label}
							description={availability(option.id)}
							onPress={() => selectCdn(option.id)}
							right={() => <RadioButton value={option.id} />}
						/>
					))}
				</RadioButton.Group>
				<SettingsSectionTitle title={t('CDN速度テスト')} />
				<Text
					variant='bodySmall'
					style={{ color: colors.onSurfaceVariant }}
				>{t('再生中の音声で、各ノードを最大約2 MB測定します。通信量がかかります。')}</Text>
				<Button
					mode='contained-tonal'
					style={styles.button}
					onPress={running ? cancel : () => void start()}
				>
					{running ? t('テストを中止') : t('テストを開始')}
				</Button>
				{sampleName ? (
					<Text variant='bodySmall'>{t('テスト音源：')}{sampleName}</Text>
				) : null}
				{preparing ? (
					<Text style={styles.preparing}>{t('音声ノードを取得中…')}</Text>
				) : null}
				{results.map(({ node, status }) => (
					<List.Item
						key={node.host}
						title={
							node.provider === 'auto'
								? t('Bilibiliの割り当てノード')
								: BILIBILI_CDN_OPTIONS.find(
										(option) => option.id === node.provider,
									)?.label
						}
						description={`${node.host}\n${status}`}
						descriptionNumberOfLines={3}
					/>
				))}
			</ScrollView>
		</View>
	)
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	content: { paddingHorizontal: 24 },
	button: { marginVertical: 16, alignSelf: 'flex-start' },
	preparing: { marginTop: 12 },
})
