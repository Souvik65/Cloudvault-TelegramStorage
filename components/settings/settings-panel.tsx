'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/use-auth-store';
import { useFileStore } from '@/store/use-file-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Plus, Check } from 'lucide-react';

export function SettingsPanel() {
  const { sessionString } = useAuthStore();
  const { storageChannelId, setStorageChannelId, setStorageChannelName, setFiles, setCurrentFolder } = useFileStore();
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');

  const fetchChannels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tg/channels', {
        headers: { 'x-tg-session': sessionString! },
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setChannels(data.channels || []);
    } catch (error: any) {
      toast.error('Failed to load channels: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [sessionString]);

  useEffect(() => {
    if (sessionString) {
      fetchChannels();
    }
  }, [sessionString, fetchChannels]);

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/tg/channels', {
        method: 'POST',
        headers: {
          'x-tg-session': sessionString!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newChannelName }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      toast.success('Channel created successfully');
      setNewChannelName('');
      await fetchChannels();

      // Auto-select the new channel
      handleSelectChannel(data.channelId.toString(), newChannelName);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleSelectChannel = async (channelId: string, channelName: string) => {
    setStorageChannelId(channelId);
    setStorageChannelName(channelName);
    setCurrentFolder('/');
    toast.success('Storage channel updated');

    // Refresh files for the new channel
    try {
      const res = await fetch(`/api/tg/files?channelId=${channelId}`, {
        headers: { 'x-tg-session': sessionString! },
      });
      const data = await res.json();
      if (!data.error) {
        setFiles(data.files);
      }
    } catch {
      toast.error('Failed to refresh files');
    }
  };

  return (
    <div className="space-y-6">
      {/* Select channel */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Storage Channel</h3>

        <div className="space-y-2">
          {/* Saved Messages option */}
          <div
            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
              storageChannelId === 'me'
                ? 'border-[#DBDBDB]/60 bg-[#DBDBDB]/10'
                : 'border-white/[0.15] bg-white/[0.05] hover:border-white/[0.30] hover:bg-white/[0.09]'
            }`}
            onClick={() => handleSelectChannel('me', 'Saved Messages')}
          >
            <div>
              <p className="font-medium text-sm text-white">Saved Messages</p>
              <p className="text-xs text-white/45">Your personal cloud storage</p>
            </div>
            {storageChannelId === 'me' && <Check className="w-4 h-4 text-[#DBDBDB]" />}
          </div>

          {loading ? (
            <p className="text-sm text-white/50 text-center py-4">Loading channels...</p>
          ) : (
            channels.map((channel) => (
              <div
                key={channel.id}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                  storageChannelId === channel.id.toString()
                    ? 'border-[#DBDBDB]/60 bg-[#DBDBDB]/10'
                    : 'border-white/[0.15] bg-white/[0.05] hover:border-white/[0.30] hover:bg-white/[0.09]'
                }`}
                onClick={() => handleSelectChannel(channel.id.toString(), channel.title)}
              >
                <div>
                  <p className="font-medium text-sm text-white">{channel.title}</p>
                  <p className="text-xs text-white/45">
                    {channel.isCreator ? 'Owner' : 'Admin'}
                  </p>
                </div>
                {storageChannelId === channel.id.toString() && <Check className="w-4 h-4 text-[#DBDBDB]" />}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create new channel */}
      <div className="pt-4 border-t border-white/[0.12] space-y-3">
        <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Create Channel</h3>
        <div className="flex gap-2">
          <Input
            placeholder="e.g., CloudVault Storage"
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value)}
            className="bg-white/[0.08] border-white/[0.18] text-white placeholder:text-white/55 focus-visible:ring-[#DBDBDB]/40"
          />
          <Button
            onClick={handleCreateChannel}
            disabled={creating || !newChannelName.trim()}
            size="sm"
            className="shrink-0 gap-1.5 bg-[#DBDBDB] text-[#3B3B3B] hover:bg-[#C4C4C4] font-semibold"
          >
            <Plus className="w-4 h-4" />
            Create
          </Button>
        </div>
        <p className="text-xs text-white/45">
          Creates a private Telegram channel for unlimited storage.
        </p>
      </div>
    </div>
  );
}
