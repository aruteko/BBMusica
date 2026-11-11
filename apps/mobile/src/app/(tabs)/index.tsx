import { useObserve } from 'expo-observe'
import { useFocusEffect, useRouter } from 'expo-router'
import { useIncomingShare } from 'expo-sharing'
import {
	type ComponentRef,
	useCallback,
	useDeferredValue,
	useEffect,
	useRef,
	useState,
} from 'react'
import {
	BackHandler,
	Keyboard,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	StyleSheet,
	ToastAndroid,
	View,
} from 'react-native'
import { useMMKVObject } from 'react-native-mmkv'
import { Searchbar, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import { alert } from '@/components/modals/AlertModal'
import NativeTabPage from '@/components/NativeTabPage'
import SkinAppbarBackground from '@/components/navigation/SkinAppbarBackground'
import HomeRecommendations from '@/features/home/HomeRecommendations'
import SearchHistory, {
	type SearchHistoryItem,
} from '@/features/search/SearchHistory'
import SearchSuggestions from '@/features/search/SearchSuggestions'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import useSkinForegroundColor from '@/hooks/theme/useSkinForegroundColor'
import { markPerfInteractive } from '@/lib/performance'
import { toastAndLogError } from '@/utils/error-handling'
import {
	matchSearchStrategies,
	navigateWithSearchStrategy,
} from '@/utils/search'

const SEARCH_HISTORY_KEY = 'bilibili_search_history'
const MAX_SEARCH_HISTORY = 10

function SearchPageContent() {
	const { colors } = useTheme()
	const insets = useSafeAreaInsets()
	const router = useRouter()
	const haveTrack = useCurrentTrack()
	const headerForegroundColor = useSkinForegroundColor()
	const [searchQuery, setSearchQuery] = useState('')
	const deferredSearchQuery = useDeferredValue(searchQuery)
	const [searchHistory, setSearchHistory] =
		useMMKVObject<SearchHistoryItem[]>(SEARCH_HISTORY_KEY)
	const [isLoading, setIsLoading] = useState(false)
	const [searchFocused, setSearchFocused] = useState(false)
	const suggestionsVisible =
		searchFocused &&
		searchQuery.trim().length > 0 &&
		deferredSearchQuery.trim().length > 0
	const searchBarRef = useRef<ComponentRef<typeof Searchbar>>(null)
	const dismissPanel = useCallback(() => {
		setSearchFocused(false)
		searchBarRef.current?.blur()
		Keyboard.dismiss()
	}, [])
	useFocusEffect(
		useCallback(() => {
			const backSubscription = BackHandler.addEventListener(
				'hardwareBackPress',
				() => {
					if (!searchFocused) return false
					dismissPanel()
					return true
				},
			)
			// Android 在输入法打开时会先由系统处理返回键，此时仍需收起面板。
			const keyboardSubscription = Keyboard.addListener(
				'keyboardDidHide',
				dismissPanel,
			)
			return () => {
				backSubscription.remove()
				keyboardSubscription.remove()
			}
		}, [dismissPanel, searchFocused]),
	)
	useFocusEffect(useCallback(() => () => dismissPanel(), [dismissPanel]))
	const [contentHeight, setContentHeight] = useState(0)
	const contentBottomPadding = haveTrack ? 86 : 24
	const { resolvedSharedPayloads, isResolving, clearSharedPayloads } =
		useIncomingShare()
	const { markInteractive } = useObserve()
	useEffect(() => {
		markInteractive()
		void markPerfInteractive()
	}, [markInteractive])

	const saveSearchHistory = useCallback(
		(history: SearchHistoryItem[]) => {
			try {
				setSearchHistory(history)
			} catch (error) {
				toastAndLogError('検索履歴の保存に失敗しました', error, 'UI.Search')
			}
		},
		[setSearchHistory],
	)

	const addSearchHistory = useCallback(
		(query: string) => {
			if (!query.trim()) return

			const newItem: SearchHistoryItem = {
				id: `history_${Date.now()}`,
				text: query,
				timestamp: Date.now(),
			}

			const currentHistory = searchHistory ?? []
			const existingIndex = currentHistory.findIndex(
				(item) => item.text.toLowerCase() === query.toLowerCase(),
			)

			let newHistory: SearchHistoryItem[]

			if (existingIndex !== -1) {
				newHistory = [
					newItem,
					...currentHistory.filter(
						(item) => item.text.toLowerCase() !== query.toLowerCase(),
					),
				]
			} else {
				newHistory = [newItem, ...currentHistory]
			}

			if (newHistory.length > MAX_SEARCH_HISTORY) {
				newHistory = newHistory.slice(0, MAX_SEARCH_HISTORY)
			}

			saveSearchHistory(newHistory)
		},
		[searchHistory, saveSearchHistory],
	)

	const handleEnter = useCallback(
		async (query: string) => {
			if (!query.trim()) return
			dismissPanel()
			setIsLoading(true)
			try {
				const result = await matchSearchStrategies(query)
				if (navigateWithSearchStrategy(result, router) === 1) {
					addSearchHistory(query)
				}
				setSearchQuery('')
			} catch (error) {
				toastAndLogError('検索に失敗しました。もう一度お試しください', error, 'UI.Search')
			} finally {
				setIsLoading(false)
			}
		},
		[addSearchHistory, dismissPanel, router],
	)

	const handleSuggestionPress = useCallback(
		(query: string) => {
			void handleEnter(query)
		},
		[handleEnter],
	)

	const handleClearHistory = useCallback(() => {
		alert(
			'検索履歴を消去しますか？',
			'すべて消去しますか？',
			[
				{ text: 'キャンセル' },
				{
					text: 'OK',
					onPress: () => {
						setSearchHistory([])
					},
				},
			],
			{ cancelable: true },
		)
	}, [setSearchHistory])

	const handleRemoveHistoryItem = useCallback(
		(id: string) => {
			const item = searchHistory?.find((h) => h.id === id)
			if (!item) return
			alert(
				'検索履歴を削除しますか？',
				`「${item.text}」を削除しますか？`,
				[
					{ text: 'キャンセル' },
					{
						text: 'OK',
						onPress: () => {
							const newHistory = searchHistory?.filter((h) => h.id !== id)
							setSearchHistory(newHistory)
						},
					},
				],
				{ cancelable: true },
			)
		},
		[searchHistory, setSearchHistory],
	)

	useEffect(() => {
		if (resolvedSharedPayloads.length === 0) return
		if (resolvedSharedPayloads.length > 1) {
			if (Platform.OS === 'android') {
				ToastAndroid.show('複数の共有コンテンツを受け取ったため、無視しました', ToastAndroid.SHORT)
			} else {
				alert(
					'複数の共有コンテンツを受け取ったため、無視しました',
					'現在のバージョンでは共有コンテンツを1件のみ処理できます。他の内容は無視しました',
					[{ text: 'OK' }],
				)
			}
		}
		const data = resolvedSharedPayloads[0]
		let query: string | undefined
		if (data.shareType === 'text') {
			query = data.value
		}
		if (!query) {
			clearSharedPayloads()
			return
		}

		clearSharedPayloads()
		void handleEnter(query)
	}, [resolvedSharedPayloads, clearSharedPayloads, handleEnter])

	return (
		<KeyboardAvoidingView
			style={[styles.container, { backgroundColor: colors.background }]}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
		>
			<SkinAppbarBackground height={insets.top + 100} />
			{searchFocused && (
				<Pressable
					style={StyleSheet.absoluteFill}
					onPress={dismissPanel}
					accessibilityLabel='検索候補を閉じる'
					testID='search-panel-backdrop'
					// 只用来点空白处收起；遥控器用返回键收起，焦点不能落在这层上。
					focusable={false}
				/>
			)}
			<View
				pointerEvents='none'
				style={[styles.header, { paddingTop: insets.top + 8 }]}
			>
				<Text
					variant='headlineSmall'
					style={[styles.title, { color: headerForegroundColor }]}
				>
					ホーム
				</Text>
			</View>
			<View
				pointerEvents='box-none'
				style={styles.searchbarContainer}
			>
				<Searchbar
					ref={searchBarRef}
					placeholder='キーワード / b23.tv / 動画リンク / av / BV'
					value={searchQuery}
					onChangeText={setSearchQuery}
					onSubmitEditing={() => void handleEnter(searchQuery)}
					onIconPress={() => void handleEnter(searchQuery)}
					onClearIconPress={() => setSearchQuery('')}
					onFocus={() => setSearchFocused(true)}
					onBlur={() => setSearchFocused(false)}
					loading={isLoading}
					editable={!isLoading}
					returnKeyType='search'
					elevation={0}
					mode='bar'
					style={[styles.searchbar, { backgroundColor: colors.surfaceVariant }]}
					testID='search-bar'
				/>
			</View>
			<View
				pointerEvents='box-none'
				style={[styles.content, { paddingBottom: contentBottomPadding }]}
				onLayout={({ nativeEvent }) =>
					setContentHeight(nativeEvent.layout.height)
				}
			>
				{isResolving ? (
					<ActivityIndicator style={styles.resolving} />
				) : (
					<>
						<SearchHistory
							searchHistory={searchHistory}
							onHistoryPress={handleSuggestionPress}
							onClearHistory={handleClearHistory}
							onRemoveHistoryItem={handleRemoveHistoryItem}
							onDismiss={dismissPanel}
							panelVisible={suggestionsVisible}
							footer={<HomeRecommendations />}
						/>
						<View
							pointerEvents='box-none'
							style={styles.suggestions}
						>
							<SearchSuggestions
								query={deferredSearchQuery}
								visible={suggestionsVisible}
								availableHeight={contentHeight - contentBottomPadding}
								onSuggestionPress={handleSuggestionPress}
							/>
						</View>
					</>
				)}
			</View>
		</KeyboardAvoidingView>
	)
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	header: { paddingHorizontal: 16, paddingBottom: 16, minHeight: 56 },
	title: { fontWeight: 'bold' },
	searchbarContainer: { paddingHorizontal: 16, paddingBottom: 16 },
	searchbar: { borderRadius: 9999 },
	content: { flex: 1, paddingHorizontal: 16 },
	suggestions: { position: 'absolute', top: 0, left: 16, right: 16, zIndex: 1 },
	resolving: { flex: 1 },
})

export default function SearchPage() {
	return (
		<NativeTabPage>
			<SearchPageContent />
		</NativeTabPage>
	)
}
