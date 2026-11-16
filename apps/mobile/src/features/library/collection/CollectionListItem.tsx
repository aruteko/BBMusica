import { useRouter } from 'expo-router'
import { memo } from 'react'

import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import GridCard from '@/components/common/GridCard'
import type { BilibiliCollection } from '@/types/apis/bilibili'
import { t } from '@/i18n'

const CollectionListItem = memo(({ item }: { item: BilibiliCollection }) => {
	const router = useRouter()

	return (
		<GridCard
			title={item.title}
			disabled={item.state === 1}
			subtitle={`${item.state === 0 ? item.upper.name : t('無効')} • ${item.media_count} ${t('曲')}`}
			onPress={() => {
				if (item.attr === 0) {
					router.navigate({
						pathname: '/playlist/remote/collection/[id]',
						params: { id: String(item.id) },
					})
				} else {
					router.navigate({
						pathname: '/playlist/remote/favorite/[id]',
						params: { id: String(item.id) },
					})
				}
			}}
			renderCover={(size) => (
				<CoverWithPlaceHolder
					id={item.id}
					cover={item.cover}
					title={item.title}
					size={size}
				/>
			)}
		/>
	)
})

CollectionListItem.displayName = 'CollectionListItem'

export default CollectionListItem
