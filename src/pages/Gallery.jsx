import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { TopBar, Loader, Avatar } from '../components/UI'
import { supabase } from '../lib/supabase'

export default function Gallery() {
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState([])
  const [caption, setCaption] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data: photos } = await supabase
      .from('photos').select('*').order('created_at', { ascending: false })
    const ids = (photos || []).map((p) => p.id)
    let likes = [], comments = []
    if (ids.length) {
      likes = (await supabase.from('photo_likes').select('*').in('photo_id', ids)).data || []
      comments = (await supabase.from('photo_comments').select('*').in('photo_id', ids)).data || []
    }
    setPosts((photos || []).map((p) => ({
      ...p,
      likes: likes.filter((l) => l.photo_id === p.id),
      comments: comments.filter((c) => c.photo_id === p.id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    })))
    setLoading(false)
  }

  useEffect(() => {
    load()
    const ch = supabase.channel('gallery-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photo_likes' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photo_comments' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photos' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  function pick(e) {
    const f = e.target.files?.[0]; if (!f) return
    setFile(f); setPreview(URL.createObjectURL(f))
  }

  async function post() {
    if (!file) return
    setBusy(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      await supabase.storage.from('photos').upload(path, file)
      const url = supabase.storage.from('photos').getPublicUrl(path).data.publicUrl
      await supabase.from('photos').insert({
        user_id: user.id, author_name: profile?.name, author_avatar: profile?.avatar_url,
        image_url: url, caption: caption.trim(),
      })
      setFile(null); setPreview(null); setCaption('')
      await load()
    } finally { setBusy(false) }
  }

  if (loading) return <div className="screen"><Loader label="Developing the photos…" /></div>

  return (
    <div className="screen">
      <TopBar title="the photo wall" />
      <div className="center rise rise-1" style={{ marginBottom: 14 }}>
        <h1 className="postcard-title" style={{ fontSize: 34 }}>📸 Photo Wall</h1>
        <p className="muted" style={{ color: 'var(--cream)' }}>Share the memories — everyone can see &amp; cheer.</p>
      </div>

      {/* Composer */}
      <div className="card rise rise-2">
        {preview ? (
          <img src={preview} alt="" style={{ width: '100%', borderRadius: 12, border: '2px solid var(--ink)' }} />
        ) : (
          <label className="btn btn-sky" style={{ cursor: 'pointer' }}>
            📷 Choose a Photo
            <input type="file" accept="image/*" onChange={pick} style={{ display: 'none' }} />
          </label>
        )}
        {preview && (
          <>
            <textarea className="textarea mt16" placeholder="Add a caption…" value={caption} onChange={(e) => setCaption(e.target.value)} />
            <div className="row" style={{ gap: 8 }}>
              <button onClick={post} disabled={busy} className="btn btn-coral" style={{ flex: 1 }}>{busy ? 'Posting…' : '🌴 Post It'}</button>
              <button onClick={() => { setFile(null); setPreview(null) }} className="btn btn-ghost btn-sm">✕</button>
            </div>
          </>
        )}
      </div>

      {/* Feed */}
      <div className="stack mt16">
        {posts.map((p, i) => (
          <PhotoCard key={p.id} post={p} delay={i} onChange={load} />
        ))}
        {posts.length === 0 && <div className="card center muted">No photos yet — be the first!</div>}
      </div>

    </div>
  )
}

function PhotoCard({ post, onChange }) {
  const { user, profile } = useAuth()
  const [comment, setComment] = useState('')
  const [showComments, setShowComments] = useState(false)
  const liked = post.likes.some((l) => l.user_id === user.id)

  async function toggleLike() {
    if (liked) {
      await supabase.from('photo_likes').delete().eq('photo_id', post.id).eq('user_id', user.id)
    } else {
      await supabase.from('photo_likes').insert({ photo_id: post.id, user_id: user.id })
    }
    onChange()
  }
  async function addComment() {
    if (!comment.trim()) return
    await supabase.from('photo_comments').insert({
      photo_id: post.id, user_id: user.id, author_name: profile?.name, body: comment.trim(),
    })
    setComment(''); onChange()
  }
  async function download() {
    const res = await fetch(post.image_url)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `wfo-${post.id}.jpg`
    a.click()
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="row" style={{ padding: 12, gap: 10 }}>
        <Avatar url={post.author_avatar} name={post.author_name} size={36} />
        <span className="display" style={{ fontSize: 14 }}>{post.author_name}</span>
      </div>
      <img src={post.image_url} alt={post.caption} style={{ width: '100%', display: 'block', borderTop: '2px solid var(--ink)', borderBottom: '2px solid var(--ink)' }} />
      <div style={{ padding: 12 }}>
        <div className="row" style={{ gap: 10 }}>
          <button onClick={toggleLike} className="pill" style={{ background: liked ? 'var(--coral)' : '#fff', color: liked ? 'var(--cream)' : 'var(--ink)', cursor: 'pointer' }}>
            {liked ? '❤️' : '🤍'} {post.likes.length}
          </button>
          <button onClick={() => setShowComments((s) => !s)} className="pill" style={{ background: '#fff', cursor: 'pointer' }}>💬 {post.comments.length}</button>
          <button onClick={download} className="pill" style={{ background: '#fff', cursor: 'pointer' }}>⬇️ Save</button>
        </div>
        {post.caption && <p className="mt8"><b className="display" style={{ fontSize: 13 }}>{post.author_name}</b> {post.caption}</p>}

        {showComments && (
          <div className="mt16">
            <div className="divider" />
            <div className="stack">
              {post.comments.map((c) => (
                <div key={c.id}><b className="display" style={{ fontSize: 12 }}>{c.author_name}:</b> <span style={{ fontSize: 14 }}>{c.body}</span></div>
              ))}
              {post.comments.length === 0 && <div className="muted" style={{ fontSize: 13 }}>No comments yet.</div>}
            </div>
            <div className="row mt8" style={{ gap: 8 }}>
              <input className="input" placeholder="Say something nice…" value={comment} onChange={(e) => setComment(e.target.value)} />
              <button onClick={addComment} className="btn btn-gold btn-sm">Post</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
