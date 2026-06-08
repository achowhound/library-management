import { useEffect, useState } from 'react'
import IsbnBarcode from '../components/IsbnBarcode'
import { API_URL } from './api'

const initialForm = {
  title: '',
  author: '',
  isbn: '',
  genre: '',
  description: '',
  language: 'English',
  floor: 1,
  libraryArea: '',
  shelfNo: 'A',
  shelfLevel: 1,
  totalCopies: 1,
};

const numericFormFields = new Set(['floor', 'shelfLevel', 'totalCopies']);

function normalizeBookToForm(book) {
  return {
    title: book.title || '',
    author: book.author || '',
    isbn: book.isbn || '',
    genre: book.genre || '',
    description: book.description || '',
    language: book.language || 'English',
    floor: book.floor ?? 1,
    libraryArea: book.libraryArea || '',
    shelfNo: book.shelfNo || 'A',
    shelfLevel: book.shelfLevel ?? 1,
    totalCopies: book.totalCopies ?? 1,
  };
}

function formatBookLocation(book) {
  if (!book.totalCopies) {
    return '暂无副本位置';
  }

  return `${book.floor ?? 1}F ${book.libraryArea || '未设置'} ${book.shelfNo || 'A'}架 ${book.shelfLevel ?? 1}层`;
}

function formatDate(value) {
  if (!value) return '暂无'
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function normalizeIsbn(value) {
  return String(value || '')
    .trim()
    .normalize('NFKC')
    .toUpperCase()
    .replace(/^ISBN(?:-1[03])?[：:]?/, '')
    .replace(/[^0-9X]/g, '');
}

function buildCopyBarcodePreview(isbn) {
  const normalizedIsbn = normalizeIsbn(isbn);
  return normalizedIsbn ? `${normalizedIsbn} 1` : '';
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',').pop() : result);
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}

export default function LibrarianBookManager({ librarian, onBack, onLogout }) {
  const [books, setBooks] = useState([])
  const [searchTerm, setSearchTerm] = useState('')  //搜索关键词
  const [searchResults, setSearchResults] = useState(null)  //搜索结果
  const [form, setForm] = useState(initialForm)
  const [editingBookId, setEditingBookId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const isEditing = editingBookId !== null
  const copyBarcodePreview = buildCopyBarcodePreview(form.isbn)

  const fetchBooks = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_URL}/books`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '获取图书列表失败')
      setBooks(Array.isArray(data.data) ? data.data : [])
    } catch (fetchError) {
      setError(fetchError.message || '获取图书列表失败')
    } finally {
      setLoading(false)
    }
  }
  // 判断输入是否为 ISBN 格式（10或13位数字，可包含短横线）
  const isIsbnFormat = (str) => {
    const clean = str.replace(/-/g, '');
    return /^\d{10}$/.test(clean) || /^\d{13}$/.test(clean);
  };

  // 搜索图书函数
  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setSearchResults(null);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
  
    const keyword = searchTerm.trim();
  
    try {
      // 第一步：先在数据库搜索
      const response = await fetch(`${API_URL}/books/search?keyword=${encodeURIComponent(keyword)}`);
      const data = await response.json();
    
      // 如果找到了结果
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        setSearchResults(data.data);
        console.log('搜索结果数量:', data.data.length);
        console.log('搜索结果:', data.data);
        setError('');
        setLoading(false);
        return;
      }
    
      // 第二步：没找到，且输入的是 ISBN 格式，则调用豆瓣接口
      if (isIsbnFormat(keyword)) {
        setError('未在馆藏中找到，正在从豆瓣获取信息...');
      
        const lookupRes = await fetch(`${API_URL}/books/lookup?isbn=${keyword}`);
        const lookupData = await lookupRes.json();
      
        if (lookupData.success && lookupData.data) {
          // 自动填充新增表单
          setForm((current) => ({
            ...current,
            title: lookupData.data.title || '',
            author: lookupData.data.author || '',
            isbn: lookupData.data.isbn || keyword,
            genre: lookupData.data.genre || '待分类',
            description: lookupData.data.description || '',
            language: lookupData.data.language || 'Chinese',
          }));
          setError('✅ 已从豆瓣获取图书信息，请确认后点击"新增图书"添加至馆藏');
          // 滚动到表单顶部
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setSearchResults(null);
        } else {
          setError('豆瓣未找到该ISBN对应的图书，请手动添加');
          setSearchResults([]);
        }
      } else {
        // 不是ISBN格式，且没找到
        setSearchResults([]);
        setError('No books found');
      }
    } catch (err) {
      console.error('搜索失败:', err);
      setError('搜索失败，请稍后重试');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  // 处理搜索输入变化
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value)
    if (e.target.value.trim() === '') {
      setSearchResults(null)  // 清空搜索时恢复全部列表
      setError('')
    }
  }

  useEffect(() => {
    void fetchBooks()
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => {
      const nextValue = numericFormFields.has(name) && value !== '' ? Number(value) : value
      return { ...current, [name]: nextValue }
    })
  }

  const handleUnauthorized = () => {
  setError('登录状态已失效，请重新登录')
  localStorage.removeItem('token')  // 删除统一 token
  localStorage.removeItem('user')   // 删除统一 user
  if (onLogout) onLogout()
}

  const handleLookupByIsbn = async () => {
    const isbn = normalizeIsbn(form.isbn)

    if (!isbn) {
      setError('请先输入 ISBN')
      setSuccess('')
      return
    }

    setLookupLoading(true)
    setError('')
    setSuccess('')
    setForm((current) => ({
      ...current,
      isbn,
      title: '',
      author: '',
      genre: '',
      language: '',
      description: '',
    }))

    try {
      const params = new URLSearchParams({ isbn })
      const response = await fetch(`${API_URL}/books/lookup?${params}`)
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || '联网获取图书信息失败')
      }

      setForm((current) => ({
        ...current,
        isbn: data.data.isbn || isbn,
        title: data.data.title || '',
        author: data.data.author || '',
        genre: data.data.genre || '',
        language: data.data.language || '',
        description: data.data.description || '',
      }))
      setSuccess('已通过 ISBN 获取图书信息')
    } catch (lookupError) {
      setError(lookupError.message || '联网获取图书信息失败')
    } finally {
      setLookupLoading(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!form.title.trim() || !form.author.trim() || !form.isbn.trim() || !form.genre.trim()) {
      setError('请填写完整的图书基础信息')
      return
    }

    if (Number(form.totalCopies) < 1) {
      setError('总册数不能小于 1')
      return
    }

    setSaving(true)

    try {
      const token = localStorage.getItem('token')
      const payload = {
        ...form,
        floor: Number(form.floor) || 1,
        shelfLevel: Number(form.shelfLevel) || 1,
        totalCopies: Number(form.totalCopies) || 1,
      }
      const response = await fetch(
        isEditing
          ? `${API_URL}/books/${editingBookId}`
          : `${API_URL}/books`,
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      )

      const data = await response.json()

      if (response.status === 401) {
        handleUnauthorized()
        return
      }

      if (!response.ok) {
        throw new Error(data.error || (isEditing ? '更新图书失败' : '新增图书失败'))
      }

      setBooks((current) => {
        if (isEditing) {
          return current.map((book) => (book.id === data.book.id ? data.book : book))
        }
        const hasExistingBook = current.some((book) => book.id === data.book.id)
        const nextBooks = hasExistingBook
          ? current.map((book) => (book.id === data.book.id ? data.book : book))
          : [...current, data.book]
        return nextBooks.sort((left, right) => left.id - right.id)
      })
      setForm(initialForm)
      setEditingBookId(null)
      setSuccess(isEditing ? `已更新《${data.book.title}》` : data.message || '图书新增成功')
    } catch (submitError) {
      setError(submitError.message || (isEditing ? '更新图书失败' : '新增图书失败'))
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (book) => {
    setEditingBookId(book.id)
    setForm(normalizeBookToForm(book))
    setError('')
    setSuccess('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (book) => {
    const confirmed = window.confirm(`确定删除《${book.title}》吗？`)
    if (!confirmed) return

    setDeletingId(book.id)
    setError('')
    setSuccess('')

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/books/${book.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await response.json()

      if (response.status === 401) {
        handleUnauthorized()
        return
      }

      if (!response.ok) {
        throw new Error(data.error || '删除图书失败')
      }

      setBooks((current) => current.filter((item) => item.id !== book.id))
      if (editingBookId === book.id) {
        setEditingBookId(null)
        setForm(initialForm)
      }
      setSuccess(`已删除《${book.title}》`)
    } catch (deleteError) {
      setError(deleteError.message || '删除图书失败')
    } finally {
      setDeletingId(null)
    }
  }

  const handleBatchImport = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setError('请选择 .xlsx 或 .xls 文件')
      event.target.value = ''
      return
    }

    setImporting(true)
    setError('')
    setSuccess('')

    try {
      const token = localStorage.getItem('token')
      const fileBase64 = await readFileAsBase64(file)
      const response = await fetch(`${API_URL}/books/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: file.name,
          fileBase64,
        }),
      })
      const data = await response.json()

      if (response.status === 401) {
        handleUnauthorized()
        return
      }

      if (!response.ok) {
        throw new Error(data.error || '批量导入失败')
      }

      setBooks((current) => {
        const nextBooks = new Map(current.map((book) => [book.id, book]))
        ;(data.books || []).forEach((book) => nextBooks.set(book.id, book))
        return Array.from(nextBooks.values()).sort((left, right) => left.id - right.id)
      })
      setSearchResults(null)
      setSuccess(data.message || '批量导入成功')
    } catch (importError) {
      setError(importError.message || '批量导入失败')
    } finally {
      setImporting(false)
      event.target.value = ''
    }
  }

  const handleReset = () => {
    setEditingBookId(null)
    setForm(initialForm)
    setError('')
    setSuccess('')
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
            >
              返回
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-800">图书管理</h1>
              <p className="text-sm text-gray-500">新增图书并管理现有馆藏记录</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-500">
              当前管理员：
              <span className="ml-1 font-semibold text-gray-700">
                {librarian?.name}（{librarian?.employeeId}）
              </span>
            </div>
            <button
              onClick={onLogout}
              className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition"
            >
              退出登录
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-6">
        <section className="bg-white rounded-2xl shadow-lg p-6 h-fit">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-800">
              {isEditing ? '编辑图书' : '新增图书'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {isEditing ? '可在这里修正图书信息和书架位置' : '带 * 的字段为必填项'}
            </p>
          </div>

          {isEditing && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              正在编辑已有馆藏记录。修改完成后点击"保存修改"，或点"取消编辑"返回新增模式。
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">书名 *</label>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                placeholder="请输入书名"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">作者 *</label>
              <input
                name="author"
                value={form.author}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                placeholder="请输入作者"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">ISBN *</label>
              <div className="flex gap-2">
                <input
                  name="isbn"
                  value={form.isbn}
                  onChange={handleChange}
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  placeholder="请输入 ISBN，同 ISBN 会作为副本追加"
                />
                <button
                  type="button"
                  onClick={handleLookupByIsbn}
                  disabled={lookupLoading || saving}
                  className="rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-white hover:bg-emerald-600 transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {lookupLoading ? '获取中...' : '联网获取'}
                </button>
              </div>
              <div className="mt-3">
                <IsbnBarcode isbn={copyBarcodePreview} height={56} />
                <p className="mt-2 text-xs text-gray-500">
                  副本条形码格式：ISBN + 空格 + 单本编号，例如 {copyBarcodePreview || '9787115428028 1'}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">分类 *</label>
              <input
                name="genre"
                value={form.genre}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                placeholder="如：Technology / Literature"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">语言</label>
              <input
                name="language"
                value={form.language}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
              />
            </div>

            {/* 书架位置字段 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">楼层</label>
                <input
                  name="floor"
                  type="number"
                  min="1"
                  value={form.floor}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">区域</label>
                <input
                  name="libraryArea"
                  value={form.libraryArea}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  placeholder="如：文学区"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">书架号</label>
                <input
                  name="shelfNo"
                  value={form.shelfNo}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  placeholder="如：A"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">层数</label>
                <input
                  name="shelfLevel"
                  type="number"
                  min="1"
                  value={form.shelfLevel}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {isEditing ? '目标总册数' : '新增副本数'} {!isEditing && <span className="text-red-500">*</span>}
              </label>
              <input
                name="totalCopies"
                type="number"
                min="1"
                value={form.totalCopies}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                新增时如果 ISBN 已存在，系统会自动追加副本并继续编号；可借册数由副本状态自动统计。
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">描述</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows="3"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                placeholder="可填写图书简介"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                {success}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleReset}
                disabled={saving}
                className="w-full rounded-lg border border-gray-300 py-3 font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isEditing ? '取消编辑' : '重置表单'}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg bg-blue-500 text-white py-3 font-semibold hover:bg-blue-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? (isEditing ? '保存中...' : '提交中...') : (isEditing ? '保存修改' : '新增图书')}
              </button>
            </div>
          </form>

          {!isEditing && (
            <div className="mt-6 rounded-xl border border-dashed border-blue-200 bg-blue-50/60 p-4">
              <h3 className="font-semibold text-gray-800">批量添加图书</h3>
              <p className="mt-1 text-sm text-gray-600">
                导入 .xlsx 文件，列名可使用：书名、作者、ISBN、分类、描述、语言、楼层、区域、书架号、层数、总册数。
              </p>
              <label className="mt-3 inline-flex cursor-pointer items-center rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 transition">
                {importing ? '导入中...' : '选择 Excel 并导入'}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleBatchImport}
                  disabled={importing || saving}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-800">馆藏列表</h2>
              <p className="text-sm text-gray-500 mt-1">
                当前共 {searchResults !== null ? searchResults.length : books.length} 本图书记录
              </p>
            </div>
  
            {/* 搜索框 */} 
            <div className="flex gap-2">
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="按书名、作者、ISBN或条形码搜索..."
                className="w-64 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
              >
                搜索
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-gray-500">正在加载图书列表...</div>
          ) : (searchResults !== null ? searchResults.length === 0 : books.length === 0) ? (
            <div className="py-12 text-center text-gray-500">还没有图书记录，先在左侧新增一本吧。</div>
          ) : (
            <div className="space-y-4">
              {(searchResults !== null ? searchResults : books).map((book) => (
                <article
                  key={book.id}
                  className="border border-gray-200 rounded-xl p-5 hover:border-blue-200 transition"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="text-lg font-bold text-gray-800">{book.title}</h3>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
                          {book.genre}
                        </span>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            book.availableCopies > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                          }`}
                        >
                          {book.availableCopies > 0 ? '可借' : '无可借副本'}
                        </span>
                      </div>

                      <p className="text-sm text-gray-600 mb-2">
                        作者：{book.author} | ISBN：{book.isbn}
                      </p>
                      <div className="mb-3 max-w-xs">
                        <IsbnBarcode isbn={book.copies?.[0]?.barcode || `${book.isbn} 1`} height={48} />
                        <p className="mt-1 text-xs text-gray-500">
                          首个副本条形码：{book.copies?.[0]?.barcode || `${book.isbn} 1`}
                        </p>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        语言：{book.language || '暂无'}
                      </p>
                      <p className="text-sm text-gray-600 mb-2">
                        位置：{formatBookLocation(book)}
                      </p>
                      <p className="text-sm text-gray-600 mb-2">
                        副本数：{book.totalCopies ?? 0} / 可借：{book.availableCopies ?? 0}
                      </p>
                      {book.copies?.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-2">
                          {book.copies.slice(0, 6).map((copy) => (
                            <span
                              key={copy.id}
                              className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-600"
                            >
                              {copy.barcode} · {copy.status}
                            </span>
                          ))}
                          {book.copies.length > 6 && (
                            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500">
                              +{book.copies.length - 6} 个副本
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-sm text-gray-500 mb-3">
                        创建时间：{formatDate(book.createdAt)}
                      </p>

                      {book.description && (
                        <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 leading-6">
                          {book.description}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 flex flex-col gap-2 sm:flex-row lg:flex-col">
                      <button
                        onClick={() => handleEdit(book)}
                        disabled={saving || deletingId === book.id}
                        className="px-4 py-2 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        编辑图书
                      </button>
                      <button
                        onClick={() => void handleDelete(book)}
                        disabled={deletingId === book.id}
                        className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {deletingId === book.id ? '删除中...' : '删除图书'}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
