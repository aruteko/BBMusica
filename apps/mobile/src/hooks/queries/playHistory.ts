import { useQuery } from '@tanstack/react-query'
import { count, desc, sql } from 'drizzle-orm'

import drizzleDb from '@/lib/db/db'
import * as schema from '@/lib/db/schema'
import { trackService } from '@/lib/services/trackService'
import type { Track } from '@/types/core/media'

export const playHistoryKeys = {
	all: ['playHistory'] as const,
	heatmap: () => [...playHistoryKeys.all, 'heatmap'] as const,
	byDate: (date: string) => [...playHistoryKeys.all, 'byDate', date] as const,
	recent: (limit: number) => [...playHistoryKeys.all, 'recent', limit] as const,
	topPlayed: (days: number, limit: number) =>
		[...playHistoryKeys.all, 'topPlayed', days, limit] as const,
}

async function fetchPlayHistoryHeatmap() {
	const result = await drizzleDb
		.select({
			date: sql<string>`date(${schema.playHistory.startTime} / 1000, 'unixepoch', 'localtime')`,
			count: count(),
		})
		.from(schema.playHistory)
		.groupBy(
			sql`date(${schema.playHistory.startTime} / 1000, 'unixepoch', 'localtime')`,
		)

	const data: Record<string, number> = {}
	result.forEach((row) => {
		if (row.date) {
			data[row.date] = row.count
		}
	})
	return data
}

export const usePlayHistoryHeatmap = () => {
	return useQuery({
		queryKey: playHistoryKeys.heatmap(),
		queryFn: fetchPlayHistoryHeatmap,
		networkMode: 'always',
		staleTime: 0,
	})
}

async function fetchPlayHistoryByDate(dateStr: string) {
	const historyRows = await drizzleDb.query.playHistory.findMany({
		where: (ph, { sql: sqlFn }) => {
			return sqlFn`date(${ph.startTime} / 1000, 'unixepoch', 'localtime') = ${dateStr}`
		},
		with: {
			track: {
				with: {
					artist: true,
					bilibiliMetadata: true,
					localMetadata: true,
				},
			},
		},
		orderBy: [desc(schema.playHistory.startTime)],
	})

	return historyRows
		.filter((row) => row.track !== null && row.track !== undefined)
		.map((row) => {
			const track = row.track as unknown as Track
			return {
				...track,
				historyId: row.id,
				playedAt: row.startTime,
			}
		})
}

export const usePlayHistoryByDate = (dateStr: string) => {
	return useQuery({
		queryKey: playHistoryKeys.byDate(dateStr),
		queryFn: () => fetchPlayHistoryByDate(dateStr),
		enabled: !!dateStr,
		networkMode: 'always',
		staleTime: 0,
	})
}

export const useMostPlayedTracks = (days: number, limit: number) => {
	return useQuery({
		queryKey: playHistoryKeys.topPlayed(days, limit),
		queryFn: async () => {
			const result = await trackService.getMostPlayedTracksInLastDays({
				days,
				limit,
			})
			if (result.isErr()) {
				throw result.error
			}
			return result.value
		},
		enabled: true,
		networkMode: 'always',
		staleTime: 60 * 1000,
	})
}

/** 最近播放过的曲目（按最后播放时间倒序，同一首只出现一次） */
async function fetchRecentlyPlayedTracks(limit: number): Promise<Track[]> {
	const rows = await drizzleDb.query.playHistory.findMany({
		with: {
			track: {
				with: {
					artist: true,
					bilibiliMetadata: true,
					localMetadata: true,
				},
			},
		},
		orderBy: [desc(schema.playHistory.startTime)],
		// 同一首歌可能重复出现，多取一些再去重
		limit: limit * 5,
	})

	const seen = new Set<number>()
	const tracks: Track[] = []
	for (const row of rows) {
		if (!row.track || seen.has(row.track.id)) continue
		seen.add(row.track.id)
		const track = trackService.formatTrack(row.track)
		if (track) tracks.push(track)
		if (tracks.length >= limit) break
	}
	return tracks
}

export const useRecentlyPlayedTracks = (limit: number) => {
	return useQuery({
		queryKey: playHistoryKeys.recent(limit),
		queryFn: () => fetchRecentlyPlayedTracks(limit),
		networkMode: 'always',
		staleTime: 0,
	})
}
