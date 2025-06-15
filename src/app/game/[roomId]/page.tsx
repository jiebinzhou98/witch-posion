'use client'

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { v4 as uuidv4 } from "uuid"

type Candy = {
  type: 'safe' | 'poison'
  clicked: boolean
}

type Room = {
  id: string
  candies: Candy[] | null
  poisonAIndex: number | null
  poisonBIndex: number | null
  current_turn: 'choosePoisonA' | 'choosePoisonB' | 'playerA' | 'playerB'
  winner: string | null
  playerA: string | null
  playerB: string | null
}

export default function GamePage() {
  const { roomId } = useParams<{ roomId: string }>()
  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<'playerA' | 'playerB' | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)

  // SSR-safe 初始化 playerId
  useEffect(() => {
    if (typeof window === 'undefined') return
    let id = localStorage.getItem('playerId')
    if (!id) {
      id = uuidv4()
      localStorage.setItem('playerId', id)
    }
    setPlayerId(id)
  }, [])

  // 拉取房间数据
  useEffect(() => {
    async function fetchRoom() {
      const { data } = await supabase.from('rooms').select('*').eq('id', roomId).single()
      if (data) setRoom(data)
      setLoading(false)
    }
    if (roomId) fetchRoom()
  }, [roomId])

  // 实时订阅房间数据
  useEffect(() => {
    if (!roomId) return
    const channel = supabase
      .channel('room-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${roomId}`,
      }, (payload) => {
        const newData = payload.new as Room
        setRoom(newData)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId])

  // 断线重连身份恢复
  useEffect(() => {
    if (!room || !playerId) return
    if (room.playerA === playerId) setRole('playerA')
    if (room.playerB === playerId) setRole('playerB')
  }, [room, playerId])

  // 双人就绪自动生成糖果
  useEffect(() => {
    if (!room || room.candies?.length || !room.playerA || !room.playerB) return
    handleGenerateCandies()
  }, [room])

  async function handleGenerateCandies() {
    const total = 25
    const candies: Candy[] = Array(total).fill(null).map(() => ({ type: 'safe', clicked: false }))
    await supabase.from('rooms').update({
      candies, current_turn: 'choosePoisonA', winner: null, poisonAIndex: null, poisonBIndex: null
    }).eq('id', roomId)
  }

  async function bindAsPlayer(selectedRole: 'playerA' | 'playerB') {
    if (!room || !playerId) return
    await supabase.from('rooms').update({ [selectedRole]: playerId }).eq('id', roomId)
    setRole(selectedRole)
  }

  async function handleSelectPoisonA(index: number) {
    await supabase.from('rooms').update({ poisonAIndex: index, current_turn: 'choosePoisonB' }).eq('id', roomId)
  }

  async function handleSelectPoisonB(index: number) {
    await supabase.from('rooms').update({ poisonBIndex: index, current_turn: 'playerA' }).eq('id', roomId)
  }

  async function handleClickCandy(index: number) {
    if (!room || !room.candies || room.winner) return
    if (room.current_turn !== role) {
      alert("还没轮到你呢！")
      return
    }
    const candies = [...room.candies]
    candies[index].clicked = true

    let poisoned = false
    if (role === 'playerA' && index === room.poisonBIndex) poisoned = true
    if (role === 'playerB' && index === room.poisonAIndex) poisoned = true

    if (poisoned) {
      await supabase.from('rooms')
        .update({ winner: role === 'playerA' ? 'playerB' : 'playerA', candies })
        .eq('id', roomId)
    } else {
      const nextTurn = role === 'playerA' ? 'playerB' : 'playerA'
      await supabase.from('rooms')
        .update({ current_turn: nextTurn, candies })
        .eq('id', roomId)
    }
  }

  // 核心 Loading 逻辑 (完全分离 role 的等待逻辑)
  if (!room || !playerId || loading) return <div>Loading...</div>

  if (!role) {
    return (
      <div className="flex flex-col gap-4 items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold">Witch Poison 🎯</h1>
        <div className="text-lg font-bold">请选择你的身份：</div>
        <Button onClick={() => bindAsPlayer('playerA')}>我是 Player A</Button>
        <Button onClick={() => bindAsPlayer('playerB')}>我是 Player B</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-2xl font-bold">Witch Poison 🎯</h1>

      <div className="text-lg">你是：{role}</div>
      <div className="text-lg">当前轮到：{room?.current_turn}</div>

      {room?.candies && (
        <div className="grid grid-cols-5 gap-4">
          {room.candies.map((candy, index) => {
            if (room.current_turn === 'choosePoisonA' && role === 'playerA') {
              return <Button key={index} onClick={() => handleSelectPoisonA(index)}>🍬</Button>
            }
            if (room.current_turn === 'choosePoisonB' && role === 'playerB') {
              return <Button key={index} onClick={() => handleSelectPoisonB(index)}>🍬</Button>
            }
            return (
              <Button key={index} onClick={() => handleClickCandy(index)} variant={candy.clicked ? 'secondary' : 'default'} disabled={candy.clicked}>🍬</Button>
            )
          })}
        </div>
      )}

      {room?.winner && (
        <div className="text-2xl font-bold text-red-500">🎉 胜者: {room.winner}</div>
      )}
    </div>
  )
}
