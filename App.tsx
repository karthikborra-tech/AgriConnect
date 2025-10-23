

import React, { useState, useEffect, useContext, createContext, useCallback, useRef, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { generateImage, startChat, generateSpeech } from './services/geminiService';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type UserRole = 'farmer' | 'buyer' | 'admin';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  farmName?: string;
  location?: string;
}

interface Product {
  id: string;
  farmerId: string;
  farmerName: string;
  name: string;
  price: number;
  photo: string;
  description: string;
  category: string;
  location: string;
  stock: number;
}

interface Order {
  id: string;
  buyerId: string;
  productId: string;
  productName: string;
  quantity: number;
  totalPrice: number;
  status: 'Pending' | 'Confirmed' | 'Shipped' | 'Delivered';
  orderDate: string;
}

interface Review {
  id: string;
  productId: string;
  productName: string;
  farmerId: string;
  buyerId: string;
  buyerName: string;
  rating: number; // 1 to 5
  comment: string;
  reviewDate: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}


type Page = 'home' | 'market' | 'contact' | 'login' | 'register' | 'farmer-dashboard' | 'buyer-dashboard' | 'admin-dashboard' | 'product-detail';

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
}

interface ToastContextType {
  addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}

// ============================================================================
// MOCK DATA & API
// ============================================================================

const MOCK_USERS: User[] = [
  { id: 'user1', name: 'John Farmer', email: 'farmer@test.com', role: 'farmer', farmName: 'Green Valley Farms', location: 'California, USA' },
  { id: 'user2', name: 'Jane Buyer', email: 'buyer@test.com', role: 'buyer', location: 'New York, USA' },
  { id: 'user3', name: 'Admin', email: 'admin@test.com', role: 'admin' },
];

const MOCK_PRODUCTS: Product[] = [
  { id: 'prod1', farmerId: 'user1', farmerName: 'Green Valley Farms', name: 'Organic Tomatoes', price: 2.5, photo: 'https://picsum.photos/seed/tomatoes/400/300', description: 'Fresh, juicy organic tomatoes, grown with care.', category: 'Vegetables', location: 'California, USA', stock: 100 },
  { id: 'prod2', farmerId: 'user1', farmerName: 'Green Valley Farms', name: 'Crisp Apples', price: 1.8, photo: 'https://picsum.photos/seed/apples/400/300', description: 'Sweet and crunchy apples, perfect for snacking.', category: 'Fruits', location: 'California, USA', stock: 250 },
  { id: 'prod3', farmerId: 'user1', farmerName: 'Green Valley Farms', name: 'Fresh Carrots', price: 1.2, photo: 'https://picsum.photos/seed/carrots/400/300', description: 'Bright orange carrots, rich in vitamins.', category: 'Vegetables', location: 'California, USA', stock: 150 },
  { id: 'prod4', farmerId: 'user1', farmerName: 'Green Valley Farms', name: 'Sweet Strawberries', price: 4.0, photo: 'https://picsum.photos/seed/strawberries/400/300', description: 'Plump and sweet strawberries, just picked.', category: 'Fruits', location: 'California, USA', stock: 80 },
];

const MOCK_ORDERS: Order[] = [
    { id: 'order1', buyerId: 'user2', productId: 'prod1', productName: 'Organic Tomatoes', quantity: 10, totalPrice: 25.0, status: 'Delivered', orderDate: '2023-10-15' },
    { id: 'order2', buyerId: 'user2', productId: 'prod2', productName: 'Crisp Apples', quantity: 20, totalPrice: 36.0, status: 'Shipped', orderDate: '2023-10-28' },
    { id: 'order3', buyerId: 'user2', productId: 'prod3', productName: 'Fresh Carrots', quantity: 5, totalPrice: 6.0, status: 'Delivered', orderDate: '2023-10-20' },
];

const MOCK_REVIEWS: Review[] = [
    { id: 'rev1', productId: 'prod1', productName: 'Organic Tomatoes', farmerId: 'user1', buyerId: 'user2', buyerName: 'Jane Buyer', rating: 5, comment: 'Absolutely fantastic! The best tomatoes I have ever had. So fresh and flavorful.', reviewDate: '2023-10-16', status: 'Approved' },
    { id: 'rev2', productId: 'prod1', productName: 'Organic Tomatoes', farmerId: 'user1', buyerId: 'user3', buyerName: 'Another Buyer', rating: 4, comment: 'Very good tomatoes, great for salads.', reviewDate: '2023-10-18', status: 'Approved' },
    { id: 'rev3', productId: 'prod2', productName: 'Crisp Apples', farmerId: 'user1', buyerId: 'user2', buyerName: 'Jane Buyer', rating: 5, comment: 'Perfectly crisp and sweet. My family loves them!', reviewDate: '2023-11-01', status: 'Pending' },
];

// ============================================================================
// CONTEXTS (AUTH & TOAST)
// ============================================================================

const AuthContext = createContext<AuthContextType | null>(null);
const ToastContext = createContext<ToastContextType | null>(null);

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  const login = (userData: User) => setUser(userData);
  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning';
}

const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(currentToasts => currentToasts.filter(toast => toast.id !== id));
    }, 5000);
  };
  
  const removeToast = (id: number) => {
    setToasts(toasts => toasts.filter(toast => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed top-5 right-5 z-50 space-y-2">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-center p-4 rounded-lg shadow-lg text-white ${
            toast.type === 'success' ? 'bg-green-500' :
            toast.type === 'error' ? 'bg-red-500' : 'bg-yellow-500'
          }`}>
            <span className="flex-grow">{toast.message}</span>
            <button onClick={() => removeToast(toast.id)} className="ml-4 font-bold">X</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};


const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
};

// ============================================================================
// SVG ICONS
// ============================================================================
const Icon: React.FC<{ name: string; className?: string }> = ({ name, className = "w-6 h-6" }) => {
    const icons: { [key: string]: React.ReactElement } = {
        'dashboard': <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 6h18M3 14h18M3 18h18" />,
        'products': <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />,
        'orders': <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />,
        'insights': <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />,
        'profile': <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
        'logout': <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />,
        'image': <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />,
        'chat': <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />,
        'send': <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />,
        'close': <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />,
        'sound': <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />,
        'star': <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />,
        'reviews': <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    };
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {icons[name]}
        </svg>
    );
};
// ============================================================================
// COMMON UI COMPONENTS
// ============================================================================

const Button: React.FC<{ onClick: (e?: React.MouseEvent<HTMLButtonElement>) => void; children: React.ReactNode; className?: string; type?: 'primary' | 'secondary' | 'danger', disabled?: boolean }> = ({ onClick, children, className = '', type = 'primary', disabled = false }) => {
    const baseClasses = "px-6 py-2 rounded-md font-semibold transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
    const typeClasses = 
        type === 'primary' ? "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500" :
        type === 'secondary' ? "bg-yellow-400 text-gray-800 hover:bg-yellow-500 focus:ring-yellow-400" :
        "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500";
    return (
        <button onClick={onClick} className={`${baseClasses} ${typeClasses} ${className}`} disabled={disabled}>
            {children}
        </button>
    );
};

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => {
    return (
        <input {...props} className={`w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent transition ${props.className}`} />
    );
};

// Fix: Pass through additional props (like onClick) to the underlying div element.
const Card: React.FC<{ children: React.ReactNode, className?: string } & React.HTMLAttributes<HTMLDivElement>> = ({ children, className, ...props }) => {
    return (
        <div {...props} className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
            {children}
        </div>
    );
};

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <div className="p-4 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold">{title}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200">
                        <Icon name="close" className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6">{children}</div>
            </div>
        </div>
    );
};

const StarRating: React.FC<{ rating: number; onRatingChange?: (rating: number) => void; size?: string }> = ({ rating, onRatingChange, size = "h-5 w-5" }) => {
    const [hoverRating, setHoverRating] = useState(0);
    const totalStars = 5;

    return (
        <div className="flex items-center">
            {[...Array(totalStars)].map((_, index) => {
                const starValue = index + 1;
                const isInteractive = !!onRatingChange;
                return (
                    <span
                        key={starValue}
                        className={`cursor-${isInteractive ? 'pointer' : 'default'} text-yellow-400`}
                        onClick={() => onRatingChange?.(starValue)}
                        onMouseEnter={() => isInteractive && setHoverRating(starValue)}
                        onMouseLeave={() => isInteractive && setHoverRating(0)}
                    >
                        <Icon name="star" className={`${size} ${starValue <= (hoverRating || rating) ? 'fill-current' : ''}`} />
                    </span>
                );
            })}
        </div>
    );
};


const Header: React.FC<{ setPage: (page: Page) => void }> = ({ setPage }) => {
    const { user, logout } = useAuth();
    const { addToast } = useToast();

    const handleLogout = () => {
        logout();
        addToast("You have been logged out.", "success");
        setPage('home');
    };

    const handleDashboard = () => {
        if(user?.role === 'farmer') setPage('farmer-dashboard');
        if(user?.role === 'buyer') setPage('buyer-dashboard');
        if(user?.role === 'admin') setPage('admin-dashboard');
    }

    return (
        <header className="bg-white shadow-md sticky top-0 z-40">
            <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                <div className="text-2xl font-bold text-green-600 cursor-pointer" onClick={() => setPage('home')}>AgriConnect</div>
                <nav className="hidden md:flex items-center space-x-6">
                    <a onClick={() => setPage('home')} className="text-gray-600 hover:text-green-600 cursor-pointer">Home</a>
                    <a onClick={() => setPage('market')} className="text-gray-600 hover:text-green-600 cursor-pointer">Market</a>
                    <a onClick={() => setPage('contact')} className="text-gray-600 hover:text-green-600 cursor-pointer">Contact</a>
                    {user ? (
                        <>
                            <a onClick={handleDashboard} className="text-gray-600 hover:text-green-600 cursor-pointer">Dashboard</a>
                            <Button onClick={handleLogout} type="secondary">Logout</Button>
                        </>
                    ) : (
                        <>
                            <a onClick={() => setPage('login')} className="text-gray-600 hover:text-green-600 cursor-pointer">Login</a>
                            <Button onClick={() => setPage('register')} type="primary">Register</Button>
                        </>
                    )}
                </nav>
            </div>
        </header>
    );
};

const Footer: React.FC = () => (
    <footer className="bg-gray-800 text-white mt-auto">
        <div className="container mx-auto px-6 py-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
                <div className="text-center md:text-left mb-4 md:mb-0">
                    <h3 className="text-xl font-bold text-green-500">AgriConnect Hub</h3>
                    <p className="text-gray-400">Connecting Farmers and Buyers</p>
                </div>
                <div className="flex space-x-4">
                    <a href="#" className="text-gray-400 hover:text-white">Facebook</a>
                    <a href="#" className="text-gray-400 hover:text-white">Twitter</a>
                    <a href="#" className="text-gray-400 hover:text-white">Instagram</a>
                </div>
            </div>
            <div className="text-center text-gray-500 mt-8 border-t border-gray-700 pt-4">
                &copy; 2024 AgriConnect Hub. All rights reserved.
            </div>
        </div>
    </footer>
);


const ProductCard: React.FC<{ product: Product; reviews: Review[]; onViewDetails: () => void; }> = ({ product, reviews, onViewDetails }) => {
    const approvedReviews = reviews.filter(r => r.productId === product.id && r.status === 'Approved');
    const avgRating = approvedReviews.length > 0
        ? approvedReviews.reduce((acc, r) => acc + r.rating, 0) / approvedReviews.length
        : 0;

    return (
        <Card className="flex flex-col cursor-pointer transition hover:shadow-xl" onClick={onViewDetails}>
            <img src={product.photo} alt={product.name} className="w-full h-48 object-cover rounded-t-lg" />
            <div className="p-4 flex flex-col flex-grow">
                <h3 className="text-xl font-semibold text-gray-800">{product.name}</h3>
                <p className="text-sm text-gray-500">{product.farmerName}</p>
                 <div className="flex items-center my-2">
                    <StarRating rating={avgRating} />
                    <span className="text-xs text-gray-500 ml-2">({approvedReviews.length} reviews)</span>
                </div>
                <p className="text-2xl font-bold text-green-600 my-2">${product.price.toFixed(2)}/kg</p>
                <p className="text-gray-600 flex-grow mb-4">{product.description.substring(0, 60)}...</p>
                <Button onClick={(e) => { e.stopPropagation(); /* logic to add to cart */ }} className="w-full">Add to Cart</Button>
            </div>
        </Card>
    );
};

const TTSButton: React.FC<{ textToSpeak: string }> = ({ textToSpeak }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const { addToast } = useToast();

  const handlePlay = async () => {
    setIsPlaying(true);
    try {
      await generateSpeech(textToSpeak);
    } catch (error) {
      console.error("TTS Error:", error);
      addToast("Failed to generate speech.", "error");
    } finally {
      setIsPlaying(false);
    }
  };

  return (
    <button onClick={handlePlay} disabled={isPlaying} className="p-2 rounded-full hover:bg-gray-200 disabled:opacity-50 transition">
      <Icon name="sound" className={`w-5 h-5 ${isPlaying ? 'text-green-500 animate-pulse' : 'text-gray-600'}`} />
    </button>
  );
};

// ============================================================================
// GEMINI-POWERED COMPONENTS
// ============================================================================

const Chatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatHistoryRef = useRef<any>(null);

  const chatSession = useRef<any>(null);

  useEffect(() => {
    if (chatHistoryRef.current) {
        chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage = { role: 'user' as 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
        if (!chatSession.current) {
            chatSession.current = await startChat();
        }
        const responseText = await chatSession.current.sendMessage(input);
        const modelMessage = { role: 'model' as 'model', text: responseText };
        setMessages(prev => [...prev, modelMessage]);
    } catch (error) {
        console.error("Chat Error:", error);
        setMessages(prev => [...prev, { role: 'model', text: "Sorry, I'm having trouble connecting." }]);
    } finally {
        setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)} className="fixed bottom-5 right-5 bg-green-600 text-white p-4 rounded-full shadow-lg hover:bg-green-700 transition">
        <Icon name="chat" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 w-full max-w-sm h-[600px] bg-white rounded-lg shadow-2xl flex flex-col z-50">
      <div className="p-4 bg-green-600 text-white rounded-t-lg flex justify-between items-center">
        <h3 className="font-bold">Agri-Assistant</h3>
        <button onClick={() => setIsOpen(false)}><Icon name="close" /></button>
      </div>
      <div ref={chatHistoryRef} className="flex-grow p-4 overflow-y-auto space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-lg max-w-xs ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && <div className="flex justify-start"><div className="p-3 rounded-lg bg-gray-200 text-gray-800">...</div></div>}
      </div>
      <div className="p-4 border-t flex">
        <Input 
          value={input} 
          onChange={e => setInput(e.target.value)} 
          onKeyPress={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask a question..."
        />
        <button onClick={handleSend} className="p-3 bg-green-600 text-white rounded-md ml-2 disabled:bg-gray-400" disabled={isLoading}>
          <Icon name="send" className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};


const ImageGenerator: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { addToast } = useToast();

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            addToast("Please enter a prompt.", "warning");
            return;
        }
        setIsLoading(true);
        setGeneratedImage(null);
        setError(null);
        try {
            const imageData = await generateImage(prompt);
            setGeneratedImage(`data:image/jpeg;base64,${imageData}`);
            addToast("Image generated successfully!", "success");
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            setError(errorMessage);
            addToast("Failed to generate image.", "error");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <h2 className="text-2xl font-bold mb-4">AI Image Generator</h2>
            <p className="text-gray-600 mb-6">Create stunning visuals for your products. Describe what you want to see, and our AI will generate it for you.</p>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <Input 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., A basket of fresh red apples in a sunny field"
                    disabled={isLoading}
                />
                <Button onClick={handleGenerate} disabled={isLoading} className="sm:w-auto">
                    {isLoading ? 'Generating...' : 'Generate Image'}
                </Button>
            </div>
            {isLoading && (
                <div className="flex justify-center items-center p-8 border-2 border-dashed border-gray-300 rounded-lg">
                    <p>Generating your image... this can take a moment.</p>
                </div>
            )}
            {error && (
                <div className="p-4 bg-red-100 text-red-700 rounded-lg">
                    <strong>Error:</strong> {error}
                </div>
            )}
            {generatedImage && (
                <div>
                    <h3 className="text-xl font-semibold mb-2">Your Generated Image:</h3>
                    <img src={generatedImage} alt={prompt} className="w-full rounded-lg shadow-lg" />
                </div>
            )}
        </Card>
    );
};
// ============================================================================
// PAGE COMPONENTS
// ============================================================================

const HomePage: React.FC<{ setPage: (page: Page) => void }> = ({ setPage }) => {
    return (
        <div className="flex-grow">
            {/* Hero Section */}
            <section className="bg-green-50 text-center py-20">
                <div className="container mx-auto px-6">
                    <h1 className="text-5xl font-bold text-gray-800 mb-4">Empowering Farmers, Nourishing Communities</h1>
                    <p className="text-xl text-gray-600 mb-8">The digital marketplace connecting you directly to the source of fresh, quality produce.</p>
                    <div className="flex justify-center gap-6">
                        <Button onClick={() => setPage('register')}>Join as Farmer</Button>
                        <Button onClick={() => setPage('register')} type="secondary">Join as Buyer</Button>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-20">
                <div className="container mx-auto px-6">
                    <h2 className="text-3xl font-bold text-center mb-12">Why AgriConnect?</h2>
                    <div className="grid md:grid-cols-3 gap-12">
                        <div className="text-center">
                            <h3 className="text-xl font-semibold mb-2">Real-Time Market Prices</h3>
                            <p className="text-gray-600">Access up-to-date market data to price your products competitively and maximize your earnings.</p>
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl font-semibold mb-2">Direct Farmer-to-Buyer</h3>
                            <p className="text-gray-600">No middlemen. Buyers get fresher produce at better prices, and farmers retain more of their profits.</p>
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl font-semibold mb-2">Secure & Transparent</h3>
                            <p className="text-gray-600">Our platform ensures secure payments and transparent order tracking from farm to doorstep.</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

const MarketPage: React.FC<{ products: Product[]; reviews: Review[]; setPage: (page: Page) => void; setSelectedProductId: (id: string) => void; }> = ({ products, reviews, setPage, setSelectedProductId }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const maxPrice = useMemo(() => Math.ceil(products.length > 0 ? Math.max(...products.map(p => p.price)) : 1000), [products]);
    const [priceRange, setPriceRange] = useState({ min: 0, max: maxPrice });
    const [locationFilter, setLocationFilter] = useState('');

    useEffect(() => {
        setPriceRange(prev => ({ ...prev, max: maxPrice }));
    }, [maxPrice]);
    
    const categories = useMemo(() => ['All', ...new Set(products.map(p => p.category))], [products]);

    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const matchesSearch = searchTerm ? 
                product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                product.description.toLowerCase().includes(searchTerm.toLowerCase()) 
                : true;
            
            const matchesCategory = selectedCategory !== 'All' ? 
                product.category === selectedCategory 
                : true;

            const matchesPrice = product.price >= priceRange.min && product.price <= priceRange.max;

            const matchesLocation = locationFilter ? 
                product.location.toLowerCase().includes(locationFilter.toLowerCase())
                : true;

            return matchesSearch && matchesCategory && matchesPrice && matchesLocation;
        });
    }, [products, searchTerm, selectedCategory, priceRange, locationFilter]);
    
    const handleViewDetails = (productId: string) => {
        setSelectedProductId(productId);
        setPage('product-detail');
    };
    
    const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setPriceRange(prev => ({ ...prev, [name]: value === '' ? 0 : parseFloat(value) }));
    };

    return (
        <div className="container mx-auto px-6 py-8 flex-grow">
            <h1 className="text-3xl font-bold mb-6">Marketplace</h1>
             <Card className="mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Search Products</label>
                        <Input
                            type="text"
                            placeholder="e.g., Organic Tomatoes"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                        <select
                            value={selectedCategory}
                            onChange={e => setSelectedCategory(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                        >
                            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                     <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">Price Range ($)</label>
                         <div className="flex items-center gap-2">
                             <Input 
                                type="number" name="min" placeholder="Min"
                                value={priceRange.min} onChange={handlePriceChange} min="0"
                             />
                             <span>-</span>
                             <Input
                                type="number" name="max" placeholder="Max"
                                value={priceRange.max} onChange={handlePriceChange} min="0"
                             />
                         </div>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                        <Input
                            type="text"
                            placeholder="e.g., California"
                            value={locationFilter}
                            onChange={e => setLocationFilter(e.target.value)}
                        />
                    </div>
                </div>
            </Card>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                {filteredProducts.length > 0 ? (
                    filteredProducts.map(product => <ProductCard key={product.id} product={product} reviews={reviews} onViewDetails={() => handleViewDetails(product.id)} />)
                ) : (
                    <div className="col-span-full text-center py-12">
                        <p className="text-gray-500 text-lg">No products match your criteria.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const ProductDetailPage: React.FC<{ productId: string; products: Product[]; reviews: Review[]; setPage: (page: Page) => void; }> = ({ productId, products, reviews, setPage }) => {
    const product = products.find(p => p.id === productId);
    const approvedReviews = reviews.filter(r => r.productId === productId && r.status === 'Approved');
    const avgRating = approvedReviews.length > 0
        ? approvedReviews.reduce((acc, r) => acc + r.rating, 0) / approvedReviews.length
        : 0;

    if (!product) {
        return <div className="container mx-auto p-8">Product not found. <a onClick={() => setPage('market')} className="text-green-600 hover:underline cursor-pointer">Go back to market</a>.</div>;
    }

    return (
        <div className="container mx-auto p-8">
            <a onClick={() => setPage('market')} className="text-green-600 hover:underline cursor-pointer mb-6 inline-block">&larr; Back to Market</a>
            <div className="grid md:grid-cols-2 gap-8">
                <div>
                    <img src={product.photo} alt={product.name} className="w-full rounded-lg shadow-lg" />
                </div>
                <div>
                    <h1 className="text-4xl font-bold">{product.name}</h1>
                    <p className="text-lg text-gray-600 mb-4">{product.farmerName}</p>
                    <div className="flex items-center my-2">
                        <StarRating rating={avgRating} size="h-6 w-6" />
                        <span className="text-md text-gray-500 ml-3">({approvedReviews.length} reviews)</span>
                    </div>
                    <p className="text-4xl font-bold text-green-600 my-4">${product.price.toFixed(2)}/kg</p>
                    <p className="text-gray-700 mb-6">{product.description}</p>
                    <Button onClick={() => {}}>Add to Cart</Button>
                </div>
            </div>
            <div className="mt-12">
                <h2 className="text-3xl font-bold mb-6">Customer Reviews</h2>
                <div className="space-y-6">
                    {approvedReviews.length > 0 ? (
                        approvedReviews.map(review => (
                            <Card key={review.id} className="bg-gray-50">
                                <div className="flex items-start">
                                    <div className="flex-shrink-0">
                                       <StarRating rating={review.rating} />
                                       <p className="font-semibold mt-1">{review.buyerName}</p>
                                       <p className="text-sm text-gray-500">{new Date(review.reviewDate).toLocaleDateString()}</p>
                                    </div>
                                    <p className="ml-6 text-gray-700">{review.comment}</p>
                                </div>
                            </Card>
                        ))
                    ) : (
                        <p>No reviews yet for this product.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

const AuthPage: React.FC<{ setPage: (page: Page) => void, isLogin: boolean }> = ({ setPage, isLogin }) => {
    const { login } = useAuth();
    const { addToast } = useToast();
    const [role, setRole] = useState<UserRole>('farmer');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Mock authentication
        const user = MOCK_USERS.find(u => u.role === role);
        if (user) {
            login(user);
            addToast(`Welcome, ${user.name}!`, 'success');
            const dashboardPage = `${role}-dashboard` as Page;
            setPage(dashboardPage);
        } else {
            addToast('User not found for this role.', 'error');
        }
    };

    return (
        <div className="flex-grow flex items-center justify-center bg-gray-50 py-12">
            <Card className="w-full max-w-md">
                <h2 className="text-3xl font-bold text-center mb-6">{isLogin ? 'Login' : 'Register'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <Input type="email" placeholder="Email Address" required />
                        <Input type="password" placeholder="Password" required />
                        {!isLogin && (
                            <div>
                                <label className="block text-gray-700 mb-2">I am a:</label>
                                <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="w-full p-3 border border-gray-300 rounded-md">
                                    <option value="farmer">Farmer</option>
                                    <option value="buyer">Buyer</option>
                                </select>
                            </div>
                        )}
                    </div>
                    <Button onClick={() => {}} className="w-full mt-6">{isLogin ? 'Login' : 'Create Account'}</Button>
                    <div className="text-center mt-4">
                        {isLogin ? (
                            <p>Don't have an account? <a onClick={() => setPage('register')} className="text-green-600 hover:underline cursor-pointer">Register</a></p>
                        ) : (
                            <p>Already have an account? <a onClick={() => setPage('login')} className="text-green-600 hover:underline cursor-pointer">Login</a></p>
                        )}
                    </div>
                </form>
            </Card>
        </div>
    );
};

const ContactPage: React.FC = () => {
  const { addToast } = useToast();
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addToast("Your message has been sent!", "success");
    // clear form logic here
  };
  return (
    <div className="container mx-auto px-6 py-12 flex-grow">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-4">Contact Us</h1>
        <p className="text-gray-600 text-center mb-12">Have questions or feedback? We'd love to hear from you.</p>
        <div className="grid md:grid-cols-2 gap-12">
          <Card>
            <h2 className="text-2xl font-bold mb-4">Send a Message</h2>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <Input placeholder="Your Name" required />
              <Input type="email" placeholder="Your Email" required />
              <textarea placeholder="Your Message" rows={5} className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent transition"></textarea>
              <Button onClick={()=>{}}>Send Message</Button>
            </form>
          </Card>
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">FAQs</h2>
            <div>
              <h3 className="font-semibold">How do I register as a farmer?</h3>
              <p className="text-gray-600">Click the 'Register' button, select 'Farmer', and fill out your farm details. Our team will review and approve your profile.</p>
            </div>
            <div>
              <h3 className="font-semibold">What are the payment options?</h3>
              <p className="text-gray-600">We support secure payments via credit card, debit card, and bank transfers.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


const FarmerDashboard: React.FC<{ setPage: (page: Page) => void, products: Product[], reviews: Review[] }> = ({setPage, products, reviews}) => {
    const [activeView, setActiveView] = useState('dashboard');
    const { user, logout } = useAuth();
    const { addToast } = useToast();

    const handleLogout = () => {
        logout();
        addToast("Logged out successfully.", "success");
        setPage('home');
    };

    const sidebarItems = [
        { id: 'dashboard', name: 'Dashboard', icon: 'dashboard' },
        { id: 'products', name: 'My Products', icon: 'products' },
        { id: 'orders', name: 'Orders', icon: 'orders' },
        { id: 'reviews', name: 'Reviews', icon: 'reviews' },
        { id: 'insights', name: 'Insights', icon: 'insights' },
        { id: 'image-generator', name: 'AI Images', icon: 'image' },
        { id: 'profile', name: 'Profile', icon: 'profile' },
    ];
    
    const priceData = [
        { name: 'Jan', Tomatoes: 2.1, Apples: 1.5 },
        { name: 'Feb', Tomatoes: 2.3, Apples: 1.6 },
        { name: 'Mar', Tomatoes: 2.2, Apples: 1.7 },
        { name: 'Apr', Tomatoes: 2.5, Apples: 1.8 },
        { name: 'May', Tomatoes: 2.8, Apples: 2.0 },
        { name: 'Jun', Tomatoes: 3.1, Apples: 2.2 },
    ];

    const farmerReviews = reviews.filter(r => r.farmerId === user?.id && r.status === 'Approved');
    const farmerAvgRating = farmerReviews.length > 0 ? farmerReviews.reduce((sum, r) => sum + r.rating, 0) / farmerReviews.length : 0;

    const renderContent = () => {
        switch (activeView) {
            case 'products':
                return <Card>
                    <h2 className="text-2xl font-bold mb-4">My Products</h2>
                    <p>Manage your product listings here.</p>
                </Card>;
            case 'orders':
                return <Card>
                    <h2 className="text-2xl font-bold mb-4">Orders Received</h2>
                    {MOCK_ORDERS.map(order => (
                      <div key={order.id} className="border-b p-2 flex justify-between items-center">
                        <span>{order.productName} (x{order.quantity})</span>
                        <span className={`px-2 py-1 text-sm rounded ${order.status === 'Delivered' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>{order.status}</span>
                      </div>
                    ))}
                </Card>;
            case 'reviews':
                return <Card>
                    <h2 className="text-2xl font-bold mb-4">Customer Reviews</h2>
                    <div className="flex items-center mb-6">
                        <span className="text-xl font-semibold mr-4">Overall Rating:</span>
                        <StarRating rating={farmerAvgRating} size="h-8 w-8" />
                        <span className="ml-2 text-lg text-gray-600">({farmerAvgRating.toFixed(1)} / 5)</span>
                    </div>
                     <div className="space-y-4">
                        {farmerReviews.length > 0 ? farmerReviews.map(review => (
                            <div key={review.id} className="p-4 border rounded-md">
                                <p className="font-semibold">{review.productName}</p>
                                <StarRating rating={review.rating} />
                                <p className="text-gray-700 mt-2">{review.comment}</p>
                                <p className="text-sm text-gray-500 mt-1">- {review.buyerName}</p>
                            </div>
                        )) : <p>You have no reviews yet.</p>}
                    </div>
                </Card>;
            case 'insights':
                return <Card>
                    <h2 className="text-2xl font-bold mb-4">Market Insights</h2>
                     <div className="flex justify-end">
                      <TTSButton textToSpeak="Here are the price trends for Tomatoes and Apples over the last six months. Both have seen a steady increase, with Tomatoes peaking in June."/>
                    </div>
                    <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer>
                            <LineChart data={priceData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="Tomatoes" stroke="#4CAF50" activeDot={{ r: 8 }} />
                                <Line type="monotone" dataKey="Apples" stroke="#FBC02D" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Card>;
            case 'image-generator':
                return <ImageGenerator />;
            case 'profile':
                 return <Card><h2 className="text-2xl font-bold mb-4">Profile</h2><p>Update your personal and farm details.</p></Card>;
            default:
                return <Card><h2 className="text-2xl font-bold mb-4">Welcome, {user?.name}!</h2><p>Here's an overview of your farm's performance.</p></Card>;
        }
    };

    return (
        <div className="flex min-h-screen bg-gray-100">
            <aside className="w-64 bg-gray-800 text-white p-4 flex flex-col">
                <h2 className="text-2xl font-bold mb-8">Farmer Panel</h2>
                <nav className="flex-grow">
                    {sidebarItems.map(item => (
                        <a key={item.id} onClick={() => setActiveView(item.id)} className={`flex items-center space-x-3 p-3 rounded-md cursor-pointer hover:bg-gray-700 ${activeView === item.id ? 'bg-green-600' : ''}`}>
                           <Icon name={item.icon} /> <span>{item.name}</span>
                        </a>
                    ))}
                </nav>
                <a onClick={handleLogout} className="flex items-center space-x-3 p-3 rounded-md cursor-pointer hover:bg-gray-700">
                    <Icon name="logout" /> <span>Logout</span>
                </a>
            </aside>
            <main className="flex-1 p-8">
                {renderContent()}
            </main>
        </div>
    );
};

const BuyerDashboard: React.FC<{ setPage: (page: Page); orders: Order[]; reviews: Review[]; addReview: (review: Review) => void; }> = ({setPage, orders, reviews, addReview}) => {
    const { user } = useAuth();
    const { addToast } = useToast();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState("");

    const myOrders = orders.filter(o => o.buyerId === user?.id);

    const handleOpenReviewModal = (order: Order) => {
        setSelectedOrder(order);
        setIsModalOpen(true);
        setRating(0);
        setComment("");
    };

    const handleSubmitReview = () => {
        if (!selectedOrder || !user) return;
        if (rating === 0) {
            addToast("Please select a star rating.", "warning");
            return;
        }
        const newReview: Review = {
            id: `rev${Date.now()}`,
            productId: selectedOrder.productId,
            productName: selectedOrder.productName,
            farmerId: MOCK_PRODUCTS.find(p => p.id === selectedOrder.productId)?.farmerId || '',
            buyerId: user.id,
            buyerName: user.name,
            rating: rating,
            comment: comment,
            reviewDate: new Date().toISOString().split('T')[0],
            status: 'Pending',
        };
        addReview(newReview);
        addToast("Review submitted for moderation!", "success");
        setIsModalOpen(false);
    };
    
    const hasReviewed = (order: Order) => {
      return reviews.some(r => r.productId === order.productId && r.buyerId === user?.id);
    }

    return (
        <div className="container mx-auto px-6 py-12 flex-grow">
          <h1 className="text-3xl font-bold mb-6">Welcome, {user?.name}!</h1>
          <Card>
            <h2 className="text-2xl font-bold mb-4">My Orders</h2>
            <div className="space-y-4">
              {myOrders.map(order => (
                <div key={order.id} className="p-4 border rounded-md flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{order.productName} (x{order.quantity})</p>
                    <p className="text-sm text-gray-500">Ordered on: {order.orderDate}</p>
                  </div>
                  <div>
                    <span className={`px-2 py-1 text-sm rounded ${order.status === 'Delivered' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>{order.status}</span>
                     {order.status === 'Delivered' && (
                        hasReviewed(order) ? (
                            <span className="ml-4 text-sm text-gray-500 italic">Reviewed</span>
                        ) : (
                            <Button onClick={() => handleOpenReviewModal(order)} className="ml-4 px-3 py-1 text-sm">Leave Review</Button>
                        )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Review: ${selectedOrder?.productName}`}>
              <div className="space-y-4">
                <div>
                  <label className="block font-semibold mb-2">Your Rating:</label>
                  <StarRating rating={rating} onRatingChange={setRating} size="h-8 w-8"/>
                </div>
                <div>
                  <label className="block font-semibold mb-2">Your Comments:</label>
                  <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} className="w-full p-2 border rounded-md"></textarea>
                </div>
                <Button onClick={handleSubmitReview} className="w-full">Submit Review</Button>
              </div>
          </Modal>
        </div>
    )
};

const AdminDashboard: React.FC<{ reviews: Review[]; updateReviewStatus: (reviewId: string, status: 'Approved' | 'Rejected') => void; }> = ({ reviews, updateReviewStatus }) => {
    const pendingReviews = reviews.filter(r => r.status === 'Pending');

    return (
        <div className="container mx-auto px-6 py-12 flex-grow">
          <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>
          <Card>
            <h2 className="text-2xl font-bold mb-4">Review Moderation ({pendingReviews.length} pending)</h2>
            <div className="space-y-4">
                {pendingReviews.length > 0 ? pendingReviews.map(review => (
                    <div key={review.id} className="p-4 border rounded-md">
                        <p className="font-bold">{review.productName}</p>
                        <p className="text-sm text-gray-500">By {review.buyerName} on {review.reviewDate}</p>
                        <div className="my-2"><StarRating rating={review.rating}/></div>
                        <p className="bg-gray-100 p-2 rounded">{review.comment}</p>
                        <div className="flex gap-4 mt-4">
                            <Button onClick={() => updateReviewStatus(review.id, 'Approved')}>Approve</Button>
                            <Button onClick={() => updateReviewStatus(review.id, 'Rejected')} type="danger">Reject</Button>
                        </div>
                    </div>
                )) : <p>No pending reviews.</p>}
            </div>
          </Card>
        </div>
    );
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

const App: React.FC = () => {
    const [page, setPage] = useState<Page>('home');
    const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
    const [orders, setOrders] = useState<Order[]>(MOCK_ORDERS);
    const [reviews, setReviews] = useState<Review[]>(MOCK_REVIEWS);
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const { addToast } = useToast();

    const addReview = (review: Review) => {
        setReviews(prev => [...prev, review]);
    };
    
    const updateReviewStatus = (reviewId: string, status: 'Approved' | 'Rejected') => {
        setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, status } : r));
        addToast(`Review has been ${status.toLowerCase()}.`, 'success');
    };

    const renderPage = () => {
        switch(page) {
            case 'home': return <HomePage setPage={setPage} />;
            case 'market': return <MarketPage products={products} reviews={reviews} setPage={setPage} setSelectedProductId={setSelectedProductId} />;
            case 'product-detail': return <ProductDetailPage productId={selectedProductId!} products={products} reviews={reviews} setPage={setPage} />;
            case 'contact': return <ContactPage />;
            case 'login': return <AuthPage setPage={setPage} isLogin={true} />;
            case 'register': return <AuthPage setPage={setPage} isLogin={false} />;
            case 'farmer-dashboard': return <FarmerDashboard setPage={setPage} products={products} reviews={reviews} />;
            case 'buyer-dashboard': return <BuyerDashboard setPage={setPage} orders={orders} reviews={reviews} addReview={addReview} />;
            case 'admin-dashboard': return <AdminDashboard reviews={reviews} updateReviewStatus={updateReviewStatus} />;
            default: return <HomePage setPage={setPage} />;
        }
    }

    const isDashboard = page.includes('dashboard');

    return (
      <AuthProvider>
        <div className="min-h-screen flex flex-col bg-gray-50 font-sans">
            {!isDashboard && <Header setPage={setPage} />}
            <main className="flex-grow flex flex-col">
                {renderPage()}
            </main>
            {!isDashboard && <Footer />}
            <Chatbot />
        </div>
      </AuthProvider>
    );
};

const MainApp = () => (
    <ToastProvider>
        <App />
    </ToastProvider>
);


export default MainApp;
