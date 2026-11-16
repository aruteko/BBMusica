import { useEffect, useState, type ReactNode } from 'react'
import { View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'
import { t } from '@/i18n'

export default function ExpandableText({
	text,
	children,
	lines,
	variant = 'bodyMedium',
	expandLabel = t('もっと見る'),
	collapseLabel = t('閉じる'),
}: {
	text: string
	children?: ReactNode
	lines: number
	variant?: 'bodySmall' | 'bodyMedium'
	expandLabel?: string
	collapseLabel?: string
}) {
	const { colors } = useTheme()
	const [expanded, setExpanded] = useState(false)
	const [canExpand, setCanExpand] = useState(false)
	useEffect(() => {
		setExpanded(false)
		setCanExpand(false)
	}, [text])
	return (
		<View>
			<Text
				variant={variant}
				numberOfLines={expanded ? undefined : lines}
				onTextLayout={({ nativeEvent }) => {
					if (!expanded) setCanExpand(nativeEvent.lines.length >= lines)
				}}
			>
				{children ?? text}
			</Text>
			{(canExpand || expanded) && (
				<Text
					variant='labelMedium'
					accessibilityRole='button'
					accessibilityState={{ expanded }}
					style={{
						color: colors.primary,
						alignSelf: 'flex-start',
						paddingVertical: 8,
					}}
					onPress={(event) => {
						event.stopPropagation()
						setExpanded((value) => !value)
					}}
				>
					{expanded ? collapseLabel : expandLabel}
				</Text>
			)}
		</View>
	)
}
