import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const apiBase = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000/api';

const NewAnnouncement: React.FC = () => {
  const { isAdmin } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('low');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const handleAddOption = useCallback(() => {
    if (pollOptions.length >= 10) {
      setError('Maximum 10 poll options allowed');
      return;
    }
    setPollOptions([...pollOptions, '']);
  }, [pollOptions]);

  const handleRemoveOption = useCallback((index: number) => {
    if (pollOptions.length <= 2) {
      setError('Poll must have at least 2 options');
      return;
    }
    setPollOptions(pollOptions.filter((_, i) => i !== index));
  }, [pollOptions]);

  const handleOptionChange = useCallback((index: number, value: string) => {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  }, [pollOptions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const token = localStorage.getItem('societyToken');
      if (!token) throw new Error('No token found');
      if (!isAdmin) throw new Error('Only admins can create announcements');
      const payload: any = { title, content, priority };
      if (pollQuestion.trim() && pollOptions.every(opt => opt.trim())) {
        payload.poll_question = pollQuestion;
        payload.poll_options = pollOptions;
      }
      console.log('Submitting payload:', payload);
      const response = await axios.post(`${apiBase}/announcements`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Response:', response.data);
      window.dispatchEvent(new Event('announcementAdded'));
      alert('Announcement created successfully');
      nav('/announcements');
    } catch (err: any) {
      console.error('Failed to create announcement:', err);
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">New Announcement</h1>
      {error && <p className="text-red-600 mb-4">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          required
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          required
          className="w-full border p-2 rounded"
          placeholder="Description"
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <select
          className="w-full border p-2 rounded"
          value={priority}
          onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <div className="space-y-2">
          <Input
            placeholder="Poll Question (optional)"
            value={pollQuestion}
            onChange={(e) => setPollQuestion(e.target.value)}
          />
          {pollOptions.map((option, index) => (
            <div key={index} className="flex items-center space-x-2">
              <Input
                placeholder={`Option ${index + 1}`}
                value={option}
                onChange={(e) => handleOptionChange(index, e.target.value)}
                className="flex-1"
              />
              {pollOptions.length > 2 && (
                <Button
                  type="button"
                  onClick={() => handleRemoveOption(index)}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            onClick={handleAddOption}
            className="bg-gray-500 text-white hover:bg-gray-600"
            disabled={pollOptions.length >= 10}
          >
            Add Option
          </Button>
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit'}
        </Button>
      </form>
    </div>
  );
};

export default NewAnnouncement;