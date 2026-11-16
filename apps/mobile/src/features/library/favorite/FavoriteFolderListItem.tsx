import { useRouter } from 'expo-router'
import { memo } from 'react'

import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import GridCard from '@/components/common/GridCard'
import type { BilibiliPlaylist } from '@/types/apis/bilibili'
import { t } from '@/i18n'

const FavoriteFolderListItem = memo(({ item }: { item: BilibiliPlaylist }) => {
	const router = useRouter()

	return (
		<GridCard
			testID={`favorite-folder-${item.id}`}
			title={item.title}
			subtitle={`${item.media_count}${t(' 曲')}`}
			onPress={() => {
				router.navigate({
					pathname: '/playlist/remote/favorite/[id]',
					params: { id: String(item.id) },
				})
			}}
			renderCover={(size) => (
				<CoverWithPlaceHolder
					id={item.id}
					cover={undefined}
					title={item.title}
					size={size}
				/>
			)}
		/>
	)
})

FavoriteFolderListItem.displayName = 'FavoriteFolderListItem'

export default FavoriteFolderListItem
