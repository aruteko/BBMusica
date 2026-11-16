import { BootSplashVideoView } from '@bbplayer/native'
import { SegmentedControl } from '@expo/ui/community/segmented-control'
import { Slider } from '@expo/ui/community/slider'
import * as Expo from 'expo'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { WavySlider } from 'expo-wavy-slider'
import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Dialog, Icon, Portal, Text, useTheme } from 'react-native-paper'
import { useSharedValue } from 'react-native-reanimated'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import AnimatedModalOverlay from '@/components/common/AnimatedModalOverlay'
import Button from '@/components/common/Button'
import UniversalSwitch from '@/components/common/UniversalSwitch'
import { alert } from '@/components/modals/AlertModal'
import { useScreenTransitionReady } from '@/hooks/router/useScreenTransitionReady'
import useSkinStore from '@/hooks/stores/useSkinStore'
import useActiveSkin from '@/hooks/theme/useActiveSkin'
import { loadSkinAssets } from '@/lib/theme/runtime'
import { uninstallSkin } from '@/lib/theme/SkinManager'
import type {
	AppSkin,
	InstalledSkinMeta,
	SkinAssetDeclaration,
	SkinAssetFeatures,
	SkinBootSplashAsset,
} from '@/lib/theme/types'
import { assetFeaturesFromManifest } from '@/lib/theme/types'
import { storage } from '@/utils/mmkv'
import toast from '@/utils/toast'
import { t } from '@/i18n'
import { CORNER_RADIUS } from '@/theme/dimensions'

const SKIN_FEATURE_LABELS: Array<[keyof SkinAssetFeatures, string]> = [
	['cards', t('ポスター')],
	// ['spaceBackgrounds', '海报'],
	['skins', t('アプリのテーマ')],
	['playIcons', t('スライダー')],
	['thumbups', t('いいねのアニメーション')],
	['loadings', t('更新アニメーション')],
	['avatarFrames', t('アイコンフレーム')],
	// ['cardBackgrounds', '卡片背景'],
	// ['emojiPackages', '表情'],
]

const EMPTY_INSTALLED_SKINS: InstalledSkinMeta[] = []

const deleteSkin = (skin: InstalledSkinMeta) => {
	alert(
		t('装扮を削除'),
		t('「{0}」を削除しますか？', skin.name),
		[
			{ text: t('キャンセル') },
			{
				text: t('削除'),
				onPress: () => {
					void uninstallSkin(skin.id)
				},
			},
		],
		{ cancelable: true },
	)
}

/**
 * 主题板块。皮肤资源包的加载与解析开销较大，因此延后到页面转场动画
 * 结束后再挂载，转场期间仅显示一个加载占位。
 */
export default function ThemeSection({
	disabled = false,
}: {
	disabled?: boolean
}) {
	const isReady = useScreenTransitionReady()

	if (!isReady) {
		return (
			<View style={styles.loading}>
				<ActivityIndicator size='small' />
			</View>
		)
	}

	return <ThemeSectionContent disabled={disabled} />
}

function ThemeSectionContent({ disabled }: { disabled: boolean }) {
	const router = useRouter()
	const colors = useTheme().colors
	const activeSkin = useActiveSkin()
	const activeSkinId = useSkinStore((state) => state.activeSkinId)
	const activeSkinIndex = useSkinStore((state) => state.activeSkinIndex)
	const activePlayIconIndex = useSkinStore((state) => state.activePlayIconIndex)
	const activeThumbUpIndex = useSkinStore((state) => state.activeThumbUpIndex)
	const activeLoadingIndex = useSkinStore((state) => state.activeLoadingIndex)
	const activeAvatarFrameIndex = useSkinStore(
		(state) => state.activeAvatarFrameIndex,
	)
	const installedSkins = useSkinStore(
		(state) => state.installedSkins ?? EMPTY_INSTALLED_SKINS,
	)
	const playFullSkinBootSplashAnimation = useSkinStore(
		(state) => state.playFullSkinBootSplashAnimation,
	)
	const selectedSkinBootSplashAssetId = useSkinStore(
		(state) => state.selectedSkinBootSplashAssetId,
	)
	const selectedSkinBootSplashMode = useSkinStore(
		(state) => state.selectedSkinBootSplashMode,
	)
	const skinSliderThumbSize = useSkinStore(
		(state) => state.skinSliderThumbSize ?? 20,
	)
	const skinSliderThumbOffsetX = useSkinStore(
		(state) => state.skinSliderThumbOffsetX ?? 0,
	)
	const skinSliderThumbOffsetY = useSkinStore(
		(state) => state.skinSliderThumbOffsetY ?? 0,
	)
	const setSkinSettings = useSkinStore((state) => state.setSkinSettings)
	const [previewAsset, setPreviewAsset] = useState<SkinBootSplashAsset | null>(
		null,
	)

	const selectedBootSplashAsset =
		activeSkin?.bootSplash.items?.find(
			(item) => item.id === selectedSkinBootSplashAssetId,
		) ?? activeSkin?.bootSplash.items?.[0]
	const selectedMode =
		selectedBootSplashAsset?.video && selectedSkinBootSplashMode === 'video'
			? t('動画')
			: t('静止画のポスター')

	const selectBootSplashAsset = (
		item: SkinBootSplashAsset,
		mode: 'poster' | 'video',
	) => {
		setSkinSettings({
			selectedSkinBootSplashAssetId: item.id,
			selectedSkinBootSplashMode: item.video ? mode : 'poster',
		})
		setPreviewAsset(null)

		const resolvedAsset = activeSkin?.bootSplash.items?.find(
			(i) => i.id === item.id,
		)
		const cardPath = resolvedAsset?.card ?? ''
		const videoPath =
			item.video && mode === 'video' ? (resolvedAsset?.video ?? '') : ''
		storage.set('boot_splash_preload', `${videoPath}|${cardPath}`)
	}

	const activeInstalledSkin = installedSkins.find(
		(skin) => skin.id === activeSkinId,
	)

	return (
		<>
			<View style={styles.settingRow}>
				<View style={styles.settingTextContainer}>
					<Text
						style={disabled ? { color: colors.onSurfaceDisabled } : undefined}
					>{t('ダイナミックテーマ')}</Text>
					<Text
						variant='bodySmall'
						style={{ color: colors.onSurfaceVariant }}
					>
						{disabled
							? t('純白の背景がオンのときは使えません')
							: activeSkin
								? activeSkin.name
								: installedSkins.length > 0
									? t('オンにすると、選んだスキンの素材を使います')
									: t('スキンの素材をダウンロードすると有効にできます')}
					</Text>
				</View>
				<UniversalSwitch
					value={activeSkinId !== null}
					onValueChange={(value) =>
						setSkinSettings({
							activeAvatarFrameIndex: 0,
							activeLoadingIndex: 0,
							activePlayIconIndex: 0,
							activeSkinId: value ? (installedSkins[0]?.id ?? null) : null,
							activeSkinIndex: 0,
							activeThumbUpIndex: 0,
						})
					}
					disabled={disabled || installedSkins.length === 0}
				/>
			</View>

			<View style={styles.section}>
				<Button
					mode='outlined'
					disabled={disabled}
					onPress={() => router.navigate('/settings/appearance/theme-search')}
				>{t('テーマを追加')}</Button>
			</View>

			{!disabled && installedSkins.length > 0 ? (
				<View style={styles.section}>
					<Text variant='titleMedium'>{t('インストール済みのテーマ')}</Text>
					<View style={styles.skinList}>
						{installedSkins.map((skin) => {
							const coverUri = localAssetUri(skin.rootUri, skin.coverPath)
							const selected = skin.id === activeSkinId
							return (
								<Pressable
									key={skin.id}
									style={[
										styles.skinRow,
										{
											borderColor: selected
												? colors.primary
												: colors.outlineVariant,
										},
									]}
									onPress={() =>
										setSkinSettings({
											activeAvatarFrameIndex: 0,
											activeLoadingIndex: 0,
											activePlayIconIndex: 0,
											activeSkinId: skin.id,
											activeSkinIndex: 0,
											activeThumbUpIndex: 0,
										})
									}
								>
									{coverUri ? (
										<Image
											source={{ uri: coverUri }}
											style={styles.skinCover}
											contentFit='cover'
										/>
									) : (
										<View
											style={[
												styles.skinCover,
												{ backgroundColor: colors.surfaceVariant },
											]}
										/>
									)}
									<View style={styles.skinText}>
										<Text numberOfLines={1}>{skin.name}</Text>
										<Text
											variant='bodySmall'
											style={{ color: colors.onSurfaceVariant }}
										>
											{selected ? t('使用中') : t('タップして切り替え')}
										</Text>
									</View>
									{selected ? (
										<Icon
											source='check-circle'
											size={20}
											color={colors.primary}
										/>
									) : null}
									<Pressable
										style={styles.iconAction}
										onPress={(event) => {
											event.stopPropagation()
											deleteSkin(skin)
										}}
										hitSlop={8}
									>
										<Icon
											source='trash-can-outline'
											size={20}
											color={colors.error}
										/>
									</Pressable>
								</Pressable>
							)
						})}
					</View>
				</View>
			) : null}

			{!disabled && activeSkinId && activeSkin ? (
				<View style={styles.section}>
					{activeInstalledSkin ? (
						<InstalledAssetSections
							activeAvatarFrameIndex={activeAvatarFrameIndex}
							activeLoadingIndex={activeLoadingIndex}
							activePlayIconIndex={activePlayIconIndex}
							activeSkinIndex={activeSkinIndex}
							activeThumbUpIndex={activeThumbUpIndex}
							onSelectAvatarFrame={(index) =>
								setSkinSettings({ activeAvatarFrameIndex: index })
							}
							onSelectLoading={(index) =>
								setSkinSettings({ activeLoadingIndex: index })
							}
							onSelectPlayIcon={(index) =>
								setSkinSettings({ activePlayIconIndex: index })
							}
							onSelectSkin={(index) =>
								setSkinSettings({ activeSkinIndex: index })
							}
							onSelectThumbUp={(index) =>
								setSkinSettings({ activeThumbUpIndex: index })
							}
							onDisableSkin={() => {
								setSkinSettings({ activeSkinIndex: -1 })
								alert(t('アプリのテーマをオフにする'), t('変更を反映するには、アプリの再起動が必要です'), [
									{ text: t('キャンセル') },
									{
										text: t('オフにして再起動'),
										onPress: () => {
											void Expo.reloadAppAsync()
										},
									},
								])
							}}
							onDisablePlayIcon={() => {
								setSkinSettings({ activePlayIconIndex: -1 })
								toast.success(t('スライダーの表示をオフにしました'))
							}}
							onDisableThumbUp={() => {
								setSkinSettings({ activeThumbUpIndex: -1 })
								toast.success(t('いいねのアニメーションの表示をオフにしました'))
							}}
							onDisableLoading={() => {
								setSkinSettings({ activeLoadingIndex: -1 })
								toast.success(t('更新アニメーションの表示をオフにしました'))
							}}
							onDisableAvatarFrame={() => {
								setSkinSettings({ activeAvatarFrameIndex: -1 })
								toast.success(t('アイコンフレームの表示をオフにしました'))
							}}
							skin={activeInstalledSkin}
							activeSkin={activeSkin}
						/>
					) : null}
					<View style={styles.sectionHeader}>
						<View style={styles.settingTextContainer}>
							<Text>{t('起動アニメーションの素材')}</Text>
							<Text
								variant='bodySmall'
								style={{ color: colors.onSurfaceVariant }}
							>
								{selectedBootSplashAsset
									? `${selectedBootSplashAsset.name} · ${selectedMode}`
									: t('既定の素材')}
							</Text>
						</View>
					</View>
					<View style={styles.assetGrid}>
						{activeSkin.bootSplash.items
							? activeSkin.bootSplash.items?.map((item) => {
									const selected = item.id === selectedBootSplashAsset?.id
									return (
										<Pressable
											key={item.id}
											style={[
												styles.assetCard,
												{
													borderColor: selected
														? colors.primary
														: colors.outlineVariant,
												},
											]}
											onPress={() => setPreviewAsset(item)}
										>
											{item.card ? (
												<Image
													source={item.card}
													style={styles.assetPoster}
													contentFit='cover'
													cachePolicy='memory-disk'
												/>
											) : null}
											{item.video ? (
												<View
													style={[
														styles.videoBadge,
														{ backgroundColor: colors.inverseSurface },
													]}
												>
													<Icon
														source='play'
														size={14}
														color={colors.inverseOnSurface}
													/>
												</View>
											) : null}
											{selected ? (
												<View
													style={[
														styles.selectedBadge,
														{ backgroundColor: colors.primary },
													]}
												>
													<Icon
														source='check'
														size={16}
														color={colors.onPrimary}
													/>
												</View>
											) : null}
										</Pressable>
									)
								})
							: null}
					</View>
				</View>
			) : null}

			{activeSkinId ? (
				<View style={styles.settingRow}>
					<View style={styles.settingTextContainer}>
						<Text>{t('テーマの起動アニメーションを最後まで再生')}</Text>
						<Text
							variant='bodySmall'
							style={{ color: colors.onSurfaceVariant }}
						>{t('起動アニメーションの終了を待ってから開く')}</Text>
					</View>
					<UniversalSwitch
						value={playFullSkinBootSplashAnimation}
						onValueChange={(value) =>
							setSkinSettings({
								playFullSkinBootSplashAnimation: value,
							})
						}
					/>
				</View>
			) : null}

			{activeSkin ? (
				<View style={styles.section}>
					<View
						style={[
							styles.sliderPanel,
							{ backgroundColor: colors.elevation.level1 },
						]}
					>
						<View style={styles.sectionHeader}>
							<View style={styles.settingTextContainer}>
								<Text variant='titleMedium'>{t('プレーヤーのスライダー')}</Text>
								<Text
									variant='bodySmall'
									style={{ color: colors.onSurfaceVariant }}
								>{t('サイズ ')}{skinSliderThumbSize} · X {skinSliderThumbOffsetX} · Y{' '}
									{skinSliderThumbOffsetY}
								</Text>
							</View>
						</View>
						<SliderPreview
							thumbUri={activeSkin.sliderThumbs[activePlayIconIndex]?.normal}
							thumbDragLeftUri={
								activeSkin.sliderThumbs[activePlayIconIndex]?.dragLeft
							}
							thumbDragRightUri={
								activeSkin.sliderThumbs[activePlayIconIndex]?.dragRight
							}
							thumbSize={skinSliderThumbSize}
							offsetX={skinSliderThumbOffsetX}
							offsetY={skinSliderThumbOffsetY}
						/>
						<SliderControl
							label={t('サイズ')}
							value={skinSliderThumbSize}
							minimumValue={12}
							maximumValue={36}
							onValueChange={(value) =>
								setSkinSettings({
									skinSliderThumbSize: Math.round(value),
								})
							}
						/>
						<SliderControl
							label='水平'
							value={skinSliderThumbOffsetX}
							minimumValue={-24}
							maximumValue={24}
							onValueChange={(value) =>
								setSkinSettings({
									skinSliderThumbOffsetX: Math.round(value),
								})
							}
						/>
						<SliderControl
							label='垂直'
							value={skinSliderThumbOffsetY}
							minimumValue={-24}
							maximumValue={24}
							onValueChange={(value) =>
								setSkinSettings({
									skinSliderThumbOffsetY: Math.round(value),
								})
							}
						/>
					</View>
				</View>
			) : null}

			<Portal>
				<BootSplashAssetPreview
					asset={disabled ? null : previewAsset}
					onDismiss={() => setPreviewAsset(null)}
					onSelect={selectBootSplashAsset}
				/>
			</Portal>
		</>
	)
}

function SliderPreview({
	offsetX,
	offsetY,
	thumbDragLeftUri,
	thumbDragRightUri,
	thumbSize,
	thumbUri,
}: {
	offsetX: number
	offsetY: number
	thumbDragLeftUri?: string | null
	thumbDragRightUri?: string | null
	thumbSize: number
	thumbUri?: string | null
}) {
	const colors = useTheme().colors
	const progress = useSharedValue(0.45)
	const waveHeight = useSharedValue(0)
	const waveVelocity = useSharedValue(0)
	const thickness = useSharedValue(3)

	return (
		<View style={styles.sliderPreview}>
			<WavySlider
				style={styles.previewSlider}
				progress={progress}
				colors={{
					activeTrackColor: colors.primary,
					bufferedTrackColor: colors.primary,
					inactiveTrackColor: colors.surfaceVariant,
					thumbColor: colors.primary,
				}}
				waveLength={30}
				waveVelocity={waveVelocity}
				waveDirection='head'
				waveHeight={waveHeight}
				waveThickness={thickness}
				trackThickness={thickness}
				thumbImageUri={thumbUri ?? undefined}
				thumbImageDragLeftUri={thumbDragLeftUri ?? undefined}
				thumbImageDragRightUri={thumbDragRightUri ?? undefined}
				thumbImageSize={thumbUri ? thumbSize : undefined}
				thumbImageOffsetX={thumbUri ? offsetX : undefined}
				thumbImageOffsetY={thumbUri ? offsetY : undefined}
				incremental={false}
				onValueChange={(value) => {
					'worklet'
					progress.set(value)
				}}
			/>
		</View>
	)
}

function AssetFeaturePanel({ features }: { features: SkinAssetFeatures }) {
	const colors = useTheme().colors

	return (
		<View style={styles.featurePanel}>
			<Text variant='titleMedium'>{t('素材の上書き')}</Text>
			<View style={styles.featureGrid}>
				{SKIN_FEATURE_LABELS.map(([key, label]) => {
					const available = features[key]
					return (
						<View
							key={key}
							style={[
								styles.featurePill,
								{
									backgroundColor: available
										? colors.primaryContainer
										: colors.surfaceVariant,
								},
							]}
						>
							<Icon
								source={available ? 'check' : 'close'}
								size={14}
								color={
									available
										? colors.onPrimaryContainer
										: colors.onSurfaceVariant
								}
							/>
							<Text
								variant='bodySmall'
								style={{
									color: available
										? colors.onPrimaryContainer
										: colors.onSurfaceVariant,
								}}
							>
								{label}
							</Text>
						</View>
					)
				})}
			</View>
		</View>
	)
}

function localAssetUri(rootUri: string, path: string | null | undefined) {
	if (!path) return null
	if (/^(file|https?):\/\//.test(path)) return path
	return `${rootUri.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

function InstalledAssetSections({
	activeAvatarFrameIndex,
	activeLoadingIndex,
	activePlayIconIndex,
	activeSkinIndex,
	activeThumbUpIndex,
	onSelectAvatarFrame,
	onSelectLoading,
	onSelectPlayIcon,
	onSelectSkin,
	onSelectThumbUp,
	onDisableSkin,
	onDisablePlayIcon,
	onDisableThumbUp,
	onDisableLoading,
	onDisableAvatarFrame,
	skin,
	activeSkin,
}: {
	activeAvatarFrameIndex: number
	activeSkin: AppSkin | null
	activeLoadingIndex: number
	activePlayIconIndex: number
	activeSkinIndex: number
	activeThumbUpIndex: number
	onSelectAvatarFrame: (index: number) => void
	onSelectLoading: (index: number) => void
	onSelectPlayIcon: (index: number) => void
	onSelectSkin: (index: number) => void
	onSelectThumbUp: (index: number) => void
	onDisableSkin?: () => void
	onDisablePlayIcon?: () => void
	onDisableThumbUp?: () => void
	onDisableLoading?: () => void
	onDisableAvatarFrame?: () => void
	skin: InstalledSkinMeta
}) {
	const [assets, setAssets] = useState<SkinAssetDeclaration | null>(null)
	const { id, rootUri } = skin
	const skinRef = useRef(skin)

	useEffect(() => {
		skinRef.current = skin
	}, [skin])

	useEffect(() => {
		let cancelled = false
		void loadSkinAssets(skinRef.current).match(
			(a) => {
				if (!cancelled) setAssets(a)
			},
			() => {
				if (!cancelled) setAssets(null)
			},
		)
		return () => {
			cancelled = true
		}
	}, [id, rootUri])

	if (!assets || !activeSkin) return null

	const features = assetFeaturesFromManifest(assets)

	return (
		<View style={styles.installedAssets}>
			<AssetFeaturePanel features={features} />
			<AssetStrip
				title={t('アプリのテーマ')}
				onDisable={onDisableSkin}
				disableActive={activeSkinIndex === -1}
				items={(assets?.skins ?? []).map((_item, index) => ({
					id: `skin-${_item.id}-${index}`,
					name: _item.name ?? `${t('テーマ ')}${index + 1}`,
					onPress: () => onSelectSkin(index),
					selected: index === activeSkinIndex,
					uri: activeSkin.skins[index]?.background.head ?? null,
				}))}
			/>
			<AssetStrip
				title={t('スライダー')}
				onDisable={onDisablePlayIcon}
				disableActive={activePlayIconIndex === -1}
				items={(assets?.play_icons ?? []).map((_item, index) => ({
					id: `play-icon-${_item.id}-${index}`,
					name: _item.name ?? `${t('スライダー ')}${index + 1}`,
					onPress: () => onSelectPlayIcon(index),
					selected: index === activePlayIconIndex,
					uri: activeSkin.sliderThumbs[index]?.normal ?? null,
				}))}
				compact
			/>
			<AssetStrip
				title={t('いいねのアニメーション')}
				onDisable={onDisableThumbUp}
				disableActive={activeThumbUpIndex === -1}
				items={(assets?.thumbups ?? []).map((_item, index) => ({
					id: `thumbup-${_item.id}-${index}`,
					name: _item.name ?? `${t('いいねのアニメーション ')}${index + 1}`,
					onPress: () => onSelectThumbUp(index),
					selected: index === activeThumbUpIndex,
					uri: activeSkin.thumbUps[index]?.preview ?? null,
				}))}
				compact
			/>
			<AssetStrip
				title={t('更新アニメーション')}
				onDisable={onDisableLoading}
				disableActive={activeLoadingIndex === -1}
				items={(assets?.loadings ?? []).map((_item, index) => ({
					id: `loading-${_item.id}-${index}`,
					name: _item.name ?? `${t('更新アニメーション ')}${index + 1}`,
					onPress: () => onSelectLoading(index),
					selected: index === activeLoadingIndex,
					uri: activeSkin.loadings[index]?.frame ?? null,
				}))}
				compact
			/>
			<AssetStrip
				title={t('アイコンフレーム')}
				onDisable={onDisableAvatarFrame}
				disableActive={activeAvatarFrameIndex === -1}
				items={(assets?.avatar_frames ?? []).map((_item, index) => ({
					id: `avatar-${_item.id}-${index}`,
					name: _item.name ?? `${t('アイコンフレーム ')}${index + 1}`,
					onPress: () => onSelectAvatarFrame(index),
					selected: index === activeAvatarFrameIndex,
					uri: activeSkin.avatarFrames[index] ?? null,
				}))}
				compact
			/>
		</View>
	)
}

function AssetStrip({
	compact,
	disableActive,
	items,
	onDisable,
	title,
}: {
	compact?: boolean
	disableActive?: boolean
	items: Array<{
		id: string
		name: string
		onPress?: () => void
		selected?: boolean
		uri: string | null
	}>
	onDisable?: () => void
	title: string
}) {
	const colors = useTheme().colors
	if (items.length === 0) return null

	return (
		<View style={styles.assetStrip}>
			<View style={styles.assetStripHeader}>
				<Text variant='titleSmall'>{title}</Text>
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
					<Text
						variant='bodySmall'
						style={{ color: colors.onSurfaceVariant }}
					>
						{items.length}
					</Text>
					{onDisable ? (
						<Pressable
							onPress={onDisable}
							disabled={disableActive}
							hitSlop={8}
						>
							<Icon
								source='trash-can-outline'
								size={18}
								color={disableActive ? colors.onSurfaceVariant : colors.error}
							/>
						</Pressable>
					) : null}
				</View>
			</View>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.assetStripContent}
			>
				{items.map((item) => (
					<Pressable
						key={item.id}
						style={compact ? styles.assetTileCompact : styles.assetTile}
						onPress={item.onPress}
					>
						<View
							style={[
								styles.assetTileImage,
								compact && styles.assetTileImageCompact,
								{
									backgroundColor: colors.surfaceVariant,
									borderColor: item.selected
										? colors.primary
										: colors.outlineVariant,
								},
							]}
						>
							{item.uri ? (
								<Image
									source={{ uri: item.uri }}
									style={StyleSheet.absoluteFill}
									contentFit='cover'
									cachePolicy='memory-disk'
								/>
							) : null}
							{item.selected ? (
								<View
									style={[
										styles.assetTileSelectedBadge,
										{ backgroundColor: colors.primary },
									]}
								>
									<Icon
										source='check'
										size={14}
										color={colors.onPrimary}
									/>
								</View>
							) : null}
						</View>
						<Text
							variant='bodySmall'
							numberOfLines={1}
							style={item.selected ? { color: colors.primary } : undefined}
						>
							{item.name}
						</Text>
					</Pressable>
				))}
			</ScrollView>
		</View>
	)
}

function SliderControl({
	label,
	maximumValue,
	minimumValue,
	onValueChange,
	value,
}: {
	label: string
	maximumValue: number
	minimumValue: number
	onValueChange: (value: number) => void
	value: number
}) {
	const colors = useTheme().colors

	return (
		<View style={styles.sliderControlRow}>
			<View style={styles.sliderControlLabel}>
				<Text variant='bodyMedium'>{label}</Text>
				<Text
					variant='bodySmall'
					style={{ color: colors.onSurfaceVariant }}
				>
					{value}
				</Text>
			</View>
			<Slider
				style={styles.controlSlider}
				minimumValue={minimumValue}
				maximumValue={maximumValue}
				step={1}
				value={value}
				onValueChange={onValueChange}
			/>
		</View>
	)
}

function BootSplashAssetPreview({
	asset,
	onDismiss,
	onSelect,
}: {
	asset: SkinBootSplashAsset | null
	onDismiss: () => void
	onSelect: (asset: SkinBootSplashAsset, mode: 'poster' | 'video') => void
}) {
	const colors = useTheme().colors
	const [selectedMode, setSelectedMode] = useState<{
		assetId: string
		mode: 'poster' | 'video'
	} | null>(null)
	const mode =
		asset && selectedMode?.assetId === asset.id
			? selectedMode.mode
			: asset?.video
				? 'video'
				: 'poster'

	return (
		<AnimatedModalOverlay
			visible={asset !== null}
			onDismiss={onDismiss}
		>
			{asset ? (
				<>
					<Dialog.Title>{asset.name}</Dialog.Title>
					<Dialog.Content>
						{asset.video ? (
							<View style={styles.segmentedControlContainer}>
								<SegmentedControl
									selectedIndex={mode === 'poster' ? 0 : 1}
									onChange={(event) => {
										const selectedIndex = event.nativeEvent.selectedSegmentIndex
										setSelectedMode({
											assetId: asset.id,
											mode: selectedIndex === 0 ? 'poster' : 'video',
										})
									}}
									values={[t('静止画のポスター'), t('動画')]}
								/>
							</View>
						) : null}
						<View
							style={[
								styles.previewFrame,
								{ backgroundColor: colors.elevation.level2 },
							]}
						>
							{mode === 'poster' || !asset.video ? (
								asset.card ? (
									<Image
										source={asset.card}
										style={styles.previewMedia}
										contentFit='contain'
										cachePolicy='memory-disk'
									/>
								) : null
							) : (
								<BootSplashVideoView
									sourceUri={asset.video}
									style={styles.previewVideo}
									contentFit='contain'
									autoPlay
									loop
									muted
								/>
							)}
						</View>
					</Dialog.Content>
					<Dialog.Actions>
						<Button
							mode='outlined'
							onPress={onDismiss}
						>{t('キャンセル')}</Button>
						<Button onPress={() => onSelect(asset, mode)}>{t('この')}{mode === 'poster' ? t('ポスター') : t('動画')}{t('を使う')}</Button>
					</Dialog.Actions>
				</>
			) : null}
		</AnimatedModalOverlay>
	)
}

const styles = StyleSheet.create({
	loading: {
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 48,
	},
	settingRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginTop: 16,
	},
	settingTextContainer: {
		flex: 1,
		marginRight: 16,
	},
	section: {
		marginTop: 22,
	},
	skinList: {
		gap: 10,
		marginTop: 12,
	},
	skinRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		borderWidth: 1,
		borderRadius: CORNER_RADIUS,
		padding: 10,
	},
	skinCover: {
		width: 48,
		height: 48,
		borderRadius: CORNER_RADIUS,
	},
	skinText: {
		flex: 1,
	},
	iconAction: {
		width: 34,
		height: 34,
		alignItems: 'center',
		justifyContent: 'center',
	},
	featurePanel: {
		gap: 10,
		marginBottom: 18,
	},
	featureGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	featurePill: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		borderRadius: CORNER_RADIUS,
		paddingHorizontal: 8,
		paddingVertical: 5,
	},
	installedAssets: {
		gap: 14,
		marginBottom: 18,
	},
	assetStrip: {
		gap: 8,
	},
	assetStripHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	assetStripContent: {
		gap: 10,
		paddingRight: 8,
	},
	assetTile: {
		width: 92,
		gap: 6,
	},
	assetTileCompact: {
		width: 76,
		gap: 6,
	},
	assetTileImage: {
		width: '100%',
		aspectRatio: 522 / 696,
		borderWidth: 2,
		borderRadius: CORNER_RADIUS,
		overflow: 'hidden',
	},
	assetTileImageCompact: {
		aspectRatio: 1,
	},
	assetTileSelectedBadge: {
		position: 'absolute',
		right: 5,
		top: 5,
		width: 20,
		height: 20,
		borderRadius: 10,
		alignItems: 'center',
		justifyContent: 'center',
	},
	sectionHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 12,
	},
	assetGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 12,
	},
	assetCard: {
		width: '31%',
		aspectRatio: 522 / 696,
		borderWidth: 2,
		borderRadius: CORNER_RADIUS,
		overflow: 'hidden',
	},
	assetPoster: {
		width: '100%',
		height: '100%',
	},
	videoBadge: {
		position: 'absolute',
		left: 6,
		top: 6,
		width: 24,
		height: 24,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
	},
	selectedBadge: {
		position: 'absolute',
		right: 6,
		top: 6,
		width: 24,
		height: 24,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
	},
	segmentedControlContainer: {
		marginBottom: 12,
	},
	previewFrame: {
		width: '100%',
		aspectRatio: 522 / 696,
		borderRadius: CORNER_RADIUS,
		overflow: 'hidden',
	},
	previewMedia: {
		...StyleSheet.absoluteFill,
	},
	previewVideo: {
		...StyleSheet.absoluteFill,
		top: 8,
		right: 8,
		bottom: 8,
		left: 8,
	},
	sliderPanel: {
		borderRadius: CORNER_RADIUS,
		padding: 14,
	},
	sliderControlRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		marginTop: 10,
	},
	sliderControlLabel: {
		width: 46,
	},
	controlSlider: {
		flex: 1,
	},
	sliderPreview: {
		height: 54,
		justifyContent: 'center',
	},
	previewSlider: {
		width: '100%' as const,
		height: 32,
	},
})
