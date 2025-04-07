import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { MessageCircle } from 'lucide-react';

interface FormData {
  username: string;
  extractType: 'followers' | 'following';
  message: string;
  delayBetweenMsgs: number;
  maxAccounts: number;
}

const initialFormData: FormData = {
  username: '',
  extractType: 'followers',
  message: '',
  delayBetweenMsgs: 60,
  maxAccounts: 20,
};

function App() {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isProcessing, setIsProcessing] = useState(false);
  const [updates, setUpdates] = useState<string[]>([]);
  const updatesRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    socketRef.current = io({
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      addUpdate('Connected to server');
    });

    socket.on('disconnect', () => {
      addUpdate('Disconnected from server. Attempting to reconnect...', 'error');
    });

    socket.on('update', (message: string) => {
      addUpdate(message);
      if (message.includes('Process completed')) {
        setIsProcessing(false);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (updatesRef.current) {
      updatesRef.current.scrollTop = updatesRef.current.scrollHeight;
    }
  }, [updates]);

  const addUpdate = (message: string, type: 'info' | 'error' | 'success' | 'warning' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setUpdates(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isProcessing && socketRef.current) {
      setIsProcessing(true);
      setUpdates([]);
      socketRef.current.emit('start_process', formData);
    }
  };

  const handleStop = () => {
    if (socketRef.current) {
      socketRef.current.emit('stop_process');
      addUpdate('Stopping process...', 'warning');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-center mb-6">
            <MessageCircle className="w-8 h-8 text-indigo-600 mr-2" />
            <h1 className="text-2xl font-bold">Instagram DM Tool</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Target Username
              </label>
              <input
                type="text"
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                pattern="[A-Za-z0-9._]{1,30}"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Extract From
              </label>
              <div className="flex space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    value="followers"
                    checked={formData.extractType === 'followers'}
                    onChange={(e) => setFormData({ ...formData, extractType: e.target.value as 'followers' | 'following' })}
                    className="form-radio text-indigo-600"
                  />
                  <span className="ml-2">Followers</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    value="following"
                    checked={formData.extractType === 'following'}
                    onChange={(e) => setFormData({ ...formData, extractType: e.target.value as 'followers' | 'following' })}
                    className="form-radio text-indigo-600"
                  />
                  <span className="ml-2">Following</span>
                </label>
              </div>
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700">
                Message
              </label>
              <textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                maxLength={1000}
                required
              />
              <p className="text-sm text-gray-500 mt-1">Maximum 1000 characters</p>
            </div>

            <div>
              <label htmlFor="delayBetweenMsgs" className="block text-sm font-medium text-gray-700">
                Delay Between Messages (seconds)
              </label>
              <input
                type="number"
                id="delayBetweenMsgs"
                value={formData.delayBetweenMsgs}
                onChange={(e) => setFormData({ ...formData, delayBetweenMsgs: parseInt(e.target.value) })}
                min={45}
                max={120}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
              <p className="text-sm text-gray-500 mt-1">Minimum 45 seconds recommended</p>
            </div>

            <div>
              <label htmlFor="maxAccounts" className="block text-sm font-medium text-gray-700">
                Maximum Number of Accounts
              </label>
              <input
                type="number"
                id="maxAccounts"
                value={formData.maxAccounts}
                onChange={(e) => setFormData({ ...formData, maxAccounts: parseInt(e.target.value) })}
                min={1}
                max={30}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
              <p className="text-sm text-gray-500 mt-1">Maximum 30 accounts per session</p>
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className={`w-full py-2 px-4 rounded-md text-white ${
                isProcessing
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
              }`}
            >
              {isProcessing ? 'Processing...' : 'Start Process'}
            </button>
          </form>

          {updates.length > 0 && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold mb-2">Status Updates</h2>
              <div
                ref={updatesRef}
                className="bg-gray-50 p-4 rounded-md h-64 overflow-y-auto space-y-2"
              >
                {updates.map((update, index) => (
                  <div key={index} className="text-sm text-gray-700">
                    {update}
                  </div>
                ))}
              </div>
              {isProcessing && (
                <button
                  onClick={handleStop}
                  className="mt-4 w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Stop Process
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
