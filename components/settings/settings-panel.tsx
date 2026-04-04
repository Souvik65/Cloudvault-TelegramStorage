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
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-hint)' }}>Storage Channel</h3>

        <div className="space-y-2">
          {/* Saved Messages option */}
          <div
            className="flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all"
            style={storageChannelId === 'me'
              ? { borderColor: 'var(--accent-rust-border)', background: 'var(--accent-rust-tint)' }
              : { borderColor: 'var(--border)', background: 'var(--bg-card)' }}
            onMouseEnter={(e) => { if (storageChannelId !== 'me') { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.background = 'var(--bg-hover)'; } }}
            onMouseLeave={(e) => { if (storageChannelId !== 'me') { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)'; } }}
            onClick={() => handleSelectChannel('me', 'Saved Messages')}
          >
            <div>
              <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>Saved Messages</p>
              <p className="text-xs" style={{ color: 'var(--text-hint)' }}>Your personal cloud storage</p>
            </div>
            {storageChannelId === 'me' && <Check className="w-4 h-4" style={{ color: 'var(--accent-rust)' }} />}
          </div>

          {loading ? (
            <p className="text-sm text-center py-4" style={{ color: 'var(--text-hint)' }}>Loading channels...</p>
          ) : (
            channels.map((channel) => (
              <div
                key={channel.id}
                className="flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all"
                style={storageChannelId === channel.id.toString()
                  ? { borderColor: 'var(--accent-rust-border)', background: 'var(--accent-rust-tint)' }
                  : { borderColor: 'var(--border)', background: 'var(--bg-card)' }}
                onMouseEnter={(e) => { if (storageChannelId !== channel.id.toString()) { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.background = 'var(--bg-hover)'; } }}
                onMouseLeave={(e) => { if (storageChannelId !== channel.id.toString()) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-card)'; } }}
                onClick={() => handleSelectChannel(channel.id.toString(), channel.title)}
              >
                <div>
                  <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{channel.title}</p>
                  <p className="text-xs" style={{ color: 'var(--text-hint)' }}>
                    {channel.isCreator ? 'Owner' : 'Admin'}
                  </p>
                </div>
                {storageChannelId === channel.id.toString() && <Check className="w-4 h-4" style={{ color: 'var(--accent-rust)' }} />}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create new channel */}
      <div className="pt-4 border-t space-y-3" style={{ borderColor: 'var(--border)' }}>
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-hint)' }}>Create Channel</h3>
        <div className="flex gap-2">
          <Input
            placeholder="e.g., StorageVault Storage"
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value)}
          />
          <Button
            onClick={handleCreateChannel}
            disabled={creating || !newChannelName.trim()}
            size="sm"
            className="shrink-0 gap-1.5 font-semibold"
            style={{ background: 'var(--accent-rust)', color: '#fff' }}
          >
            <Plus className="w-4 h-4" />
            Create
          </Button>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-hint)' }}>
          Creates a private Telegram channel for unlimited storage.
        </p>
      </div>
    </div>
  );
}
