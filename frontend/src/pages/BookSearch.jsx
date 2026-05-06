import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DueReminderBanner from '../components/DueReminderBanner';

function BookSearch() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [searchTitle, setSearchTitle] = useState('');
  const [searchAuthor, setSearchAuthor] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedBook, setSelectedBook] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [availableCopies, setAvailableCopies] = useState({});
  const [showCopies, setShowCopies] = useState(null);
  const [activeTab, setActiveTab] = useState('search');
  const [bookRatings, setBookRatings] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (e) {
        console.error('Failed to parse user data');
      }
    }
  }, []);

  const getToken = () => localStorage.getItem('token');

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);
    setMessage('');

    try {
      const params = new URLSearchParams();
      if (searchTitle) params.append('title', searchTitle);
      if (searchAuthor) params.append('author', searchAuthor);
      if (searchKeyword) params.append('keyword', searchKeyword);

      const response = await fetch(`http://localhost:3001/books/search?${params}`);
      const result = await response.json();

      if (result.success) {
        setBooks(result.data);
      } else {
        setBooks([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setBooks([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableCopies = async (bookId) => {
    const token = getToken();
    if (!token) {
      setMessage('请先登录');
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/reader/available-copies/${bookId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        setMessage('登录已过期，请重新登录');
        setTimeout(() => navigate('/login'), 1500);
        return;
      }

      const data = await response.json();

      if (data.copies && Array.isArray(data.copies)) {
        setAvailableCopies(prev => ({ ...prev, [bookId]: data.copies }));
      } else {
        setAvailableCopies(prev => ({ ...prev, [bookId]: [] }));
      }
      setShowCopies(showCopies === bookId ? null : bookId);
    } catch (error) {
      setMessage('获取副本列表失败');
    }
  };

  const handleBorrowCopy = async (copyId, bookTitle) => {
    const token = getToken();
    if (!token) {
      setMessage('请先登录');
      return;
    }

    setMessage('');
    try {
      const response = await fetch(`http://localhost:3001/api/reader/borrow/${copyId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`借阅成功！${bookTitle}`);
        handleSearch();
        setShowCopies(null);
      } else {
        setMessage(data.message || '借阅失败');
      }
    } catch (error) {
      setMessage('借阅失败: ' + error.message);
    }
  };

  const fetchBookRatings = async (bookId) => {
    try {
      const response = await fetch(`http://localhost:3001/api/ratings/book/${bookId}`);
      if (response.ok) {
        const data = await response.json();
        setBookRatings(data);
      }
    } catch (error) {
      console.error('Failed to fetch ratings:', error);
    }
  };

  const handleViewDetails = async (bookId) => {
    setDetailLoading(true);
    setDetailError('');

    try {
      const response = await fetch(`http://localhost:3001/books/${bookId}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to load book detail');
      }

      setSelectedBook(result.data);
      await fetchBookRatings(bookId);
    } catch (error) {
      setDetailError(error.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetails = () => {
    setSelectedBook(null);
    setDetailError('');
    setBookRatings(null);
  };

  const handleReset = () => {
    setSearchTitle('');
    setSearchAuthor('');
    setSearchKeyword('');
    setBooks([]);
    setSearched(false);
    setMessage('');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '早上好';
    if (hour < 18) return '下午好';
    return '晚上好';
  };

  const StarRatingDisplay = ({ value, size = 'md' }) => {
    const sizeClass = size === 'sm' ? 'text-sm' : 'text-lg';
    return (
      <span className={`${sizeClass} text-yellow-400`}>
        {'★'.repeat(value)}{'☆'.repeat(5 - value)}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="text-2xl">📚</div>
            <h1 className="text-xl font-bold text-gray-800">图书馆管理系统</h1>
            <span className="bg-green-100 text-green-600 text-xs px-2 py-1 rounded-full">读者</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-500">{getGreeting()}</p>
              <p className="font-semibold text-gray-800">{user?.name || '读者'}</p>
              <p className="text-xs text-gray-400">{user?.email || ''}</p>
            </div>
            <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition text-sm">
              退出登录
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <DueReminderBanner />

        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-6 mb-8 text-white">
          <h2 className="text-2xl font-bold mb-2">{getGreeting()}，{user?.name || '读者'}！</h2>
          <p className="opacity-90">欢迎回来，在这里您可以搜索和借阅图书。</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div
            onClick={() => setActiveTab('search')}
            className={`bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition cursor-pointer ${activeTab === 'search' ? 'ring-2 ring-blue-500' : ''}`}
          >
            <div className="text-4xl mb-4">🔍</div>
            <h2 className="text-xl font-bold mb-2">图书搜索</h2>
            <p className="text-gray-500 text-sm mb-4">搜索并浏览图书</p>
            <button className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition">
              进入 →
            </button>
          </div>

          <div
            onClick={() => navigate('/history')}
            className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition cursor-pointer"
          >
            <div className="text-4xl mb-4">📋</div>
            <h2 className="text-xl font-bold mb-2">借阅记录</h2>
            <p className="text-gray-500 text-sm mb-4">查看我的借阅历史</p>
            <button className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition">
              进入 →
            </button>
          </div>

          <div
            onClick={() => navigate('/announcements')}
            className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition cursor-pointer"
          >
            <div className="text-4xl mb-4">📢</div>
            <h2 className="text-xl font-bold mb-2">公告通知</h2>
            <p className="text-gray-500 text-sm mb-4">查看图书馆公告</p>
            <button className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition">
              进入 →
            </button>
          </div>
        </div>

        {message && (
          <div className={`p-4 rounded-lg mb-6 ${message.includes('成功') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span>🔍</span> 搜索图书
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">书名</label>
              <input
                type="text"
                value={searchTitle}
                onChange={(e) => setSearchTitle(e.target.value)}
                placeholder="请输入书名"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">作者</label>
              <input
                type="text"
                value={searchAuthor}
                onChange={(e) => setSearchAuthor(e.target.value)}
                placeholder="请输入作者名"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">关键词</label>
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="请输入关键词"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '搜索中...' : '搜索'}
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
            >
              重置
            </button>
          </div>
        </div>

        {searched && (
          <>
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span>📚</span> 搜索结果 ({books.length})
            </h2>
            {books.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                未找到图书
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {books.map((book) => (
                  <div key={book.id} className="bg-white rounded-lg shadow-md p-5 border border-gray-200 hover:shadow-lg transition">
                    <h3 className="text-lg font-semibold text-blue-600 mb-3">{book.title}</h3>
                    <p className="text-gray-600 mb-2"><strong>作者:</strong> {book.author}</p>
                    <p className="text-gray-600 mb-2"><strong>ISBN:</strong> {book.isbn}</p>
                    <p className="text-gray-600 mb-2"><strong>库存:</strong> {book.availableCopies || 0} / {book.totalCopies || 1}</p>
                    <p className="text-gray-600 mb-3">
                      <strong>评分:</strong> 
                      {book.averageRating !== null ? (
                        <span className="text-yellow-400">{'★'.repeat(Math.round(book.averageRating))}{'☆'.repeat(5 - Math.round(book.averageRating))}</span>
                      ) : (
                        <span className="text-gray-400">暂无评分</span>
                      )}
                      {book.averageRating !== null && (
                        <span className="text-gray-500 text-sm ml-2">({book.averageRating}/5, {book.totalRatings}条评价)</span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleViewDetails(book.id)}
                        className="px-3 py-1.5 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 transition"
                      >
                        查看详情
                      </button>
                      {book.availableCopies > 0 && (
                        <button
                          onClick={() => fetchAvailableCopies(book.id)}
                          className="px-3 py-1.5 bg-cyan-500 text-white text-sm rounded-lg hover:bg-cyan-600 transition"
                        >
                          {showCopies === book.id ? '隐藏副本' : '查看副本'}
                        </button>
                      )}
                    </div>

                    {showCopies === book.id && availableCopies[book.id] && availableCopies[book.id].length > 0 && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <strong className="text-sm text-gray-700 block mb-2">可用副本:</strong>
                        {availableCopies[book.id].map(copy => (
                          <div key={copy.id} className="bg-white p-2 rounded mb-2 flex flex-wrap justify-between items-center gap-2">
                            <span className="text-sm text-gray-600">
                              条码: {copy.barcode} | 位置: {copy.floor}F {copy.libraryArea} {copy.shelfNo}-{copy.shelfLevel}
                            </span>
                            <button
                              onClick={() => handleBorrowCopy(copy.id, book.title)}
                              className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition"
                            >
                              借阅此副本
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {showCopies === book.id && (!availableCopies[book.id] || availableCopies[book.id].length === 0) && (
                      <div className="mt-4 p-3 bg-yellow-50 rounded-lg text-yellow-700 text-sm">
                        目前没有可用副本
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {selectedBook && (
          <div onClick={closeDetails} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div onClick={e => e.stopPropagation()} className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">{selectedBook.title}</h2>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <p className="text-gray-600"><strong>作者:</strong> {selectedBook.author}</p>
                <p className="text-gray-600"><strong>ISBN:</strong> {selectedBook.isbn}</p>
                <p className="text-gray-600"><strong>分类:</strong> {selectedBook.genre}</p>
                <p className="text-gray-600"><strong>语言:</strong> {selectedBook.language || 'English'}</p>
                <p className="text-gray-600"><strong>库存:</strong> {selectedBook.availableCopies || 0} / {selectedBook.totalCopies || 1}</p>
                {bookRatings && bookRatings.totalRatings > 0 && (
                  <p className="text-gray-600">
                    <strong>评分:</strong> <StarRatingDisplay value={Math.round(bookRatings.averageRating)} size="sm" /> ({bookRatings.averageRating.toFixed(1)}/5, {bookRatings.totalRatings}条评价)
                  </p>
                )}
              </div>

              {selectedBook.description && (
                <div className="mb-4">
                  <strong className="text-gray-700">简介:</strong>
                  <p className="text-gray-600 mt-1">{selectedBook.description}</p>
                </div>
              )}

              {bookRatings && bookRatings.ratings && bookRatings.ratings.length > 0 && (
                <div className="mb-4">
                  <strong className="text-gray-700 block mb-2">最新评价:</strong>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {bookRatings.ratings.slice(0, 5).map((rating) => (
                      <div key={rating.id} className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex justify-between items-start mb-1">
                          <div>
                            <span className="font-medium text-gray-800">{rating.user?.name || '匿名用户'}</span>
                            <StarRatingDisplay value={rating.stars} size="sm" />
                          </div>
                          <span className="text-xs text-gray-400">
                            {new Date(rating.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {rating.review && (
                          <p className="text-gray-600 text-sm">{rating.review}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  {bookRatings.totalRatings > 5 && (
                    <p className="text-sm text-gray-500 mt-2 text-center">
                      还有 {bookRatings.totalRatings - 5} 条评价...
                    </p>
                  )}
                </div>
              )}

              {bookRatings && bookRatings.totalRatings === 0 && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg text-center text-gray-500">
                  暂无评价
                </div>
              )}

              <button
                onClick={closeDetails}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
              >
                关闭
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default BookSearch;