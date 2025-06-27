'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

interface Room {
  id: number
  player1_id: string | null
  player2_id: string | null
  player1_ready: boolean
  player2_ready: boolean
  game_started: boolean | null
  game_ended: boolean
  current_target_id?: string | null
  target_x?: number | null
  target_y?: number | null
  player1_score?: number | null
  player2_score?: number | null
}

export default function ReactionRoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const router = useRouter()
  const numericRoomId = Number(roomId)

  const [room, setRoom] = useState<Room | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'joined' | 'full' | 'error'>('loading')
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  // 玩家唯一 ID
  useEffect(() => {
    const pid = localStorage.getItem('reaction-player-id')
    if (!pid) {
      const newId = crypto.randomUUID()
      localStorage.setItem('reaction-player-id', newId)
      setPlayerId(newId)
    } else {
      setPlayerId(pid)
    }
  }, [])

  // 加入房间逻辑
  useEffect(() => {
    if (!playerId || !numericRoomId) return

    async function joinRoom() {
      const { data: roomData, error } = await supabase
        .from('reaction_rooms')
        .select('*')
        .eq('id', numericRoomId)
        .single()

      if (error || !roomData) {
        setStatus('error')
        return
      }

      if (
        roomData.player1_id &&
        roomData.player2_id &&
        playerId !== roomData.player1_id &&
        playerId !== roomData.player2_id
      ) {
        setStatus('full')
        return
      }

      if (roomData.player1_id !== playerId && !roomData.player2_id) {
        await supabase
          .from('reaction_rooms')
          .update({ player2_id: playerId })
          .eq('id', numericRoomId)

        roomData.player2_id = playerId
      }

      setRoom(roomData)
      setStatus('joined')
    }

    joinRoom()
  }, [playerId, numericRoomId])

  // 监听房间数据变更
  useEffect(() => {
    if (!roomId) return

    const channel = supabase
      .channel(`reaction_room_${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'reaction_rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const updated = payload.new as Room
          console.log('📡 房间更新:', updated)
          setRoom(updated)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId])

  // 玩家点击准备
  async function handleReady() {
    if (!room || !playerId) return

    const field = playerId === room.player1_id ? 'player1_ready' : 'player2_ready'
    await supabase
      .from('reaction_rooms')
      .update({ [field]: true })
      .eq('id', room.id)
  }

  // 玩家都准备，Player1 自动开始游戏
  useEffect(() => {
    if (!room || !playerId) return

    const bothReady = room.player1_ready && room.player2_ready
    const notStarted = room.game_started !== true
    const isPlayer1 = playerId === room.player1_id

    if (bothReady && notStarted && isPlayer1) {
      console.log('🟢 Player1 正在开始游戏...')
      supabase
        .from('reaction_rooms')
        .update({ game_started: true })
        .eq('id', room.id)
    }
  }, [room, playerId])

  // 倒计时逻辑
  useEffect(() => {
    if (!room?.game_started || room.game_ended) return

    setTimeLeft(30)
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null) return null
        if (prev <= 1) {
          clearInterval(timer)
          supabase
            .from('reaction_rooms')
            .update({ game_ended: true })
            .eq('id', room.id)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [room?.game_started])

  // Player1 控制生成目标
  useEffect(() => {
    if (!room || !room.game_started || room.game_ended || playerId !== room.player1_id) return

    let running = true

    const generateTarget = async () => {
      if (!running) return

      const delay = Math.random() * 1000 + 1000
      await new Promise((r) => setTimeout(r, delay))

      const { data: latestRoom } = await supabase
        .from('reaction_rooms')
        .select('game_started, game_ended')
        .eq('id', room.id)
        .single()

      if (!latestRoom?.game_started || latestRoom?.game_ended) return

      await supabase.from('reaction_rooms').update({
        current_target_id: crypto.randomUUID(),
        target_x: Math.random(),
        target_y: Math.random(),
      }).eq('id', room.id)

      generateTarget()
    }

    generateTarget()
    return () => { running = false }
  }, [room?.game_started, room?.game_ended, playerId])

  if (status === 'loading') return <div className="p-8 text-center">加载中...</div>
  if (status === 'error') return <div className="p-8 text-center text-red-500">房间不存在或加载失败</div>
  if (status === 'full') return <div className="p-8 text-center text-red-500">房间已满，无法加入</div>

  const youAre = playerId === room?.player1_id ? 'Player 1' : 'Player 2'
  const isYouReady =
    playerId === room?.player1_id ? room?.player1_ready :
    playerId === room?.player2_id ? room?.player2_ready : false

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-2xl font-bold">⚡ Reaction 对战房间 #{room?.id}</h1>

      {!room?.game_started && room && (
        <>
          <p>你是：{youAre}</p>
          {room.player1_id && room.player2_id ? (
            room.player1_ready && room.player2_ready ? (
              <p>✅ 双方已准备，游戏即将开始...</p>
            ) : (
              <p>🧑‍🤝‍🧑 双方已进入，等待准备中...</p>
            )
          ) : (
            <p>⏳ 等待对手进入中...</p>
          )}
          <p>玩家1：{room.player1_ready ? '✅ 准备' : '⏳ 未准备'}</p>
          <p>玩家2：{room.player2_ready ? '✅ 准备' : '⏳ 未准备'}</p>
          {!isYouReady && <Button onClick={handleReady}>准备</Button>}
        </>
      )}

      {room?.game_started && !room?.game_ended && (
        <>
          <p className="text-green-600 font-semibold">🎮 游戏进行中！</p>
          <p className="text-xl text-blue-600">🕙 剩余时间：{timeLeft}</p>
          <div className="flex gap-8 font-semibold text-lg">
            <span>Player 1 分数：{room.player1_score ?? 0}</span>
            <span>Player 2 分数：{room.player2_score ?? 0}</span>
          </div>
        </>
      )}

      {room?.current_target_id && !room?.game_ended && (
        <div
          className="absolute w-12 h-12 bg-red-500 rounded-full cursor-pointer"
          style={{
            top: `${(room.target_y ?? 0) * 100}%`,
            left: `${(room.target_x ?? 0) * 100}%`,
            transform: 'translate(-50%, -50%)',
          }}
          onClick={async () => {
            if (!room || !playerId) return

            const { data: latest } = await supabase
              .from('reaction_rooms')
              .select('current_target_id')
              .eq('id', room.id)
              .single()

            if (!latest || latest.current_target_id !== room.current_target_id) return

            const field = playerId === room.player1_id ? 'player1_score' : 'player2_score'
            const newScore = ((room as any)[field] || 0) + 1

            await supabase.from('reaction_rooms').update({
              [field]: newScore,
              current_target_id: null,
            }).eq('id', room.id)
          }}
        />
      )}

      {room?.game_ended && (
        <>
          <p className="text-xl text-red-500">🎉 游戏结束</p>
          <p>最终比分：</p>
          <p>Player 1: {room.player1_score ?? 0}</p>
          <p>Player 2: {room.player2_score ?? 0}</p>
          <p className="font-bold mt-2">
            {room.player1_score === room.player2_score
              ? '🤝 平局！'
              : (room.player1_score ?? 0) > (room.player2_score ?? 0)
              ? '🏆 Player 1 获胜！'
              : '🏆 Player 2 获胜！'}
          </p>
        </>
      )}

      <Button onClick={() => router.push('/')}>退出</Button>
    </div>
  )
}
