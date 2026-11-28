'use client'

import { useEffect, useState } from 'react'

export default function ServerTime() {
  const [time, setTime] = useState('--:--:--')

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
    const updateTime = () => setTime(formatter.format(new Date()))
    updateTime()
    const intervalId = window.setInterval(updateTime, 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  return <p>Server time: <time>{time}</time></p>
}
