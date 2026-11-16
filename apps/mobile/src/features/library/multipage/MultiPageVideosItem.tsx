import { useRouter } from 'expo-router'
import { memo } from 'react'

import CoverWithPlaceHolder from '@/components/common/CoverWithPlaceHolder'
import GridCard from '@/components/common/GridCard'
import type { BilibiliFavoriteListContent } from '@/types/apis/bilibili'
import { formatDurationToHHMMSS } from '@/utils/time'

const MultiPageVideosItem = memo(
	({ item }: { item: BilibiliFavoriteListContent }) => {
		const router = useRouter()

		return (
			<GridCard
				title={item.title}
				subtitle={`${item.upper.name} • ${item.duration ? formatDurationToHHMMSS(item.duration) : ''}`}
				onPress={() => {
					router.navigate({
						pathname: '/playlist/remote/multipage/[bvid]',
						params: { bvid: item.bvid },
					})
				}}
				renderCover={(size) => (
					<CoverWithPlaceHolder
						id={item.bvid}
						cover={item.cover}
						title={item.title}
						size={size}
					/>
				)}
			/>
		)
	},
)

MultiPageVideosItem.displayName = 'MultiPageVideosItem'

export default MultiPageVideosItem
