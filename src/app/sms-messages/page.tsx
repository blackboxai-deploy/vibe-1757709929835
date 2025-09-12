"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { SmsLog } from '@/types/sms';

export default function SmsMessages() {
  const [sendForm, setSendForm] = useState({
    recipient: '',
    message: '',
    simPort: 1,
    sending: false
  });

  const [messages, setMessages] = useState<SmsLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [gatewayStatus, setGatewayStatus] = useState<'online' | 'offline'>('offline');
  const [availablePorts, setAvailablePorts] = useState<any[]>([]);
  const [refreshingPorts, setRefreshingPorts] = useState(false);

  useEffect(() => {
    loadMessages();
    checkGatewayStatus();
    
    // Auto-refresh messages every 30 seconds
    const interval = setInterval(loadMessages, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadMessages = async () => {
    setLoading(true);
    try {
      // Simulate loading messages from localStorage/API
      const savedMessages = localStorage.getItem('sms_messages');
      if (savedMessages) {
        setMessages(JSON.parse(savedMessages));
      } else {
        // Load mock data for demonstration
        const mockMessages: SmsLog[] = [
          {
            id: 'sms_001',
            direction: 'outbound',
            recipient: '+355694123456',
            message: 'Përshëndetje! Ky është një mesazh test nga CRM Worksuite.',
            provider: 'dinstar',
            status: 'delivered',
            message_type: 'original',
            sent_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
            delivered_at: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
            created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
            updated_at: new Date(Date.now() - 1000 * 60 * 4).toISOString()
          },
          {
            id: 'sms_002',
            direction: 'inbound',
            sender: '+355694987654',
            message: 'Faleminderit për informacionin!',
            provider: 'dinstar',
            status: 'received',
            message_type: 'original',
            received_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
            created_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
            updated_at: new Date(Date.now() - 1000 * 60 * 2).toISOString()
          }
        ];
        setMessages(mockMessages);
        localStorage.setItem('sms_messages', JSON.stringify(mockMessages));
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkGatewayStatus = () => {
    try {
      const config = localStorage.getItem('dinstar_config');
      if (config) {
        const parsedConfig = JSON.parse(config);
        // Simple check if config is complete
        const isConfigured = parsedConfig.baseUrl && parsedConfig.username && parsedConfig.password;
        setGatewayStatus(isConfigured ? 'online' : 'offline');
        
        // Load available SIM ports
        if (parsedConfig.simPorts && parsedConfig.simPorts.length > 0) {
          setAvailablePorts(parsedConfig.simPorts);
          // Set default SIM port if not already set
          if (!sendForm.simPort && parsedConfig.simPort) {
            setSendForm(prev => ({ ...prev, simPort: parsedConfig.simPort }));
          }
        }
      }
    } catch (error) {
      setGatewayStatus('offline');
    }
  };

  const refreshSimPorts = async () => {
    setRefreshingPorts(true);
    try {
      const config = localStorage.getItem('dinstar_config');
      if (!config) {
        alert('Gateway nuk është i konfiguruar');
        return;
      }

      const parsedConfig = JSON.parse(config);
      
      const response = await fetch('/api/dinstar/sim-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baseUrl: parsedConfig.baseUrl,
          port: parsedConfig.port,
          username: parsedConfig.username,
          password: parsedConfig.password
        }),
      });

      const result = await response.json();
      
      if (result.success && result.data.ports) {
        setAvailablePorts(result.data.ports);
        
        // Update local storage with fresh port data
        const updatedConfig = { ...parsedConfig, simPorts: result.data.ports };
        localStorage.setItem('dinstar_config', JSON.stringify(updatedConfig));
        
        alert('Portat SIM u përditësuan me sukses!');
      } else {
        alert('Gabim në ngarkimin e portave: ' + (result.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error refreshing SIM ports:', error);
      alert('Gabim në lidhjen me gateway');
    } finally {
      setRefreshingPorts(false);
    }
  };

  const sendSms = async () => {
    if (!sendForm.recipient || !sendForm.message) {
      alert('Ju lutem plotësoni numrin dhe mesazhin');
      return;
    }

    if (gatewayStatus === 'offline') {
      alert('Gateway nuk është i konfiguruar. Shkoni tek Konfigurimi për ta vendosur.');
      return;
    }

    // Validate SIM port selection
    if (availablePorts.length > 0) {
      const selectedPort = availablePorts.find(p => p.port === sendForm.simPort);
      if (!selectedPort) {
        alert('Ju lutem zgjidhni një portë SIM');
        return;
      }
      if (selectedPort.status !== 'active') {
        alert('Porta SIM e zgjedhur nuk është aktive. Zgjidhni një portë tjetër.');
        return;
      }
    }

    setSendForm(prev => ({ ...prev, sending: true }));

    try {
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient: sendForm.recipient,
          message: sendForm.message,
          simPort: sendForm.simPort
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Add message to local list
        const newMessage: SmsLog = {
          id: `sms_${Date.now()}`,
          direction: 'outbound',
          recipient: sendForm.recipient,
          message: sendForm.message,
          provider: 'dinstar',
          status: 'sent',
          message_type: 'original',
          sent_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const updatedMessages = [newMessage, ...messages];
        setMessages(updatedMessages);
        localStorage.setItem('sms_messages', JSON.stringify(updatedMessages));

        // Clear form
        setSendForm({ recipient: '', message: '', simPort: sendForm.simPort, sending: false });
        
        alert('SMS u dërgua me sukses!');
      } else {
        alert(`Gabim në dërgimin e SMS: ${result.message}`);
      }
    } catch (error) {
      console.error('SMS send error:', error);
      alert('Gabim në dërgimin e SMS. Provoni sërish.');
    } finally {
      setSendForm(prev => ({ ...prev, sending: false }));
    }
  };

  const formatPhoneNumber = (phone: string) => {
    // Albanian phone number formatting
    return phone.replace(/(\+355)(\d{2})(\d{3})(\d{4})/, '$1 $2 $3 $4');
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      sent: 'bg-blue-100 text-blue-800',
      delivered: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      received: 'bg-purple-100 text-purple-800',
      pending: 'bg-yellow-100 text-yellow-800'
    };
    
    const labels = {
      sent: 'Dërguar',
      delivered: 'Dorëzuar',
      failed: 'Gabim',
      received: 'Marrë',
      pending: 'Duke procesuar'
    };
    
    return (
      <Badge className={colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('sq-AL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const outboundMessages = messages.filter(m => m.direction === 'outbound');
  const inboundMessages = messages.filter(m => m.direction === 'inbound');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Duke ngarkuar mesazhet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">SMS Messages</h1>
              <p className="text-gray-600 mt-2">Dërgoni dhe merrni SMS përmes gateway Dinstar</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${gatewayStatus === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-600">
                  Gateway: {gatewayStatus === 'online' ? 'Online' : 'Offline'}
                </span>
              </div>
              
              {/* Current Selected SIM Port Info */}
              {availablePorts.length > 0 && (
                <div className="flex items-center space-x-2 px-3 py-1 bg-blue-50 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-sm text-blue-800">
                    {(() => {
                      const selectedPort = availablePorts.find(p => p.port === sendForm.simPort);
                      return selectedPort 
                        ? `Porta ${selectedPort.port}: ${selectedPort.simNumber}`
                        : `Porta ${sendForm.simPort}`;
                    })()}
                  </span>
                </div>
              )}
              
              <Button 
                onClick={() => window.location.href = '/sms-config'}
                variant="outline"
                size="sm"
              >
                Konfigurimi
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Send SMS Form */}
          <div className="lg:col-span-1">
            <Card className="shadow-lg sticky top-6">
              <CardHeader>
                <CardTitle className="text-xl text-gray-800">Dërgo SMS</CardTitle>
                <p className="text-sm text-gray-600">Dërgoni SMS tek numrat tuaj</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="recipient" className="text-sm font-medium text-gray-700">
                    Numri Marrës <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="recipient"
                    type="tel"
                    placeholder="+355694123456"
                    value={sendForm.recipient}
                    onChange={(e) => setSendForm(prev => ({ ...prev, recipient: e.target.value }))}
                    className="mt-1"
                  />
                </div>

                {/* SIM Port Selection - Enhanced */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="simPort" className="text-sm font-medium text-gray-700">
                      Porta SIM {availablePorts.length > 0 && <span className="text-red-500">*</span>}
                    </Label>
                    <Button
                      onClick={refreshSimPorts}
                      disabled={refreshingPorts || gatewayStatus === 'offline'}
                      size="sm"
                      variant="outline"
                      className="text-xs"
                    >
                      {refreshingPorts ? 'Duke përditësuar...' : 'Rifresko Portat'}
                    </Button>
                  </div>

                  {availablePorts.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {availablePorts.map((port) => (
                        <div
                          key={port.port}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            sendForm.simPort === port.port
                              ? 'border-blue-500 bg-blue-50'
                              : port.status === 'active'
                              ? 'border-gray-300 hover:border-gray-400'
                              : 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                          }`}
                          onClick={() => {
                            if (port.status === 'active') {
                              setSendForm(prev => ({ ...prev, simPort: port.port }));
                            }
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                sendForm.simPort === port.port
                                  ? 'border-blue-500 bg-blue-500'
                                  : 'border-gray-300'
                              }`}>
                                {sendForm.simPort === port.port && (
                                  <div className="w-2 h-2 rounded-full bg-white"></div>
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  Porta {port.port}
                                </p>
                                <p className="text-sm text-gray-600">{port.simNumber}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge
                                className={`text-xs ${
                                  port.status === 'active'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {port.status === 'active' ? 'Aktive' : 'Jo Aktive'}
                              </Badge>
                              <span className="text-xs text-gray-500">{port.operator}</span>
                            </div>
                          </div>
                          {port.status === 'active' && (
                            <div className="mt-2 flex items-center text-xs text-gray-500">
                              <div className="flex items-center space-x-4">
                                <span>Signal: {port.signal}%</span>
                                <div className="flex space-x-1">
                                  {[1, 2, 3, 4].map((bar) => (
                                    <div
                                      key={bar}
                                      className={`w-1 h-3 rounded ${
                                        (port.signal / 25) >= bar
                                          ? 'bg-green-500'
                                          : 'bg-gray-300'
                                      }`}
                                    ></div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                      <p className="text-sm text-yellow-800 mb-2">
                        Nuk ka porta SIM të ngarkuara
                      </p>
                      <p className="text-xs text-yellow-700">
                        Klikoni "Rifresko Portat" për të ngarkuar portat SIM nga gateway
                      </p>
                    </div>
                  )}
                  
                  <p className="text-xs text-gray-500 mt-2">
                    Zgjidhni portën SIM që dëshironi të përdorni për këtë mesazh
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="message" className="text-sm font-medium text-gray-700">
                    Mesazhi <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="message"
                    placeholder="Shkruani mesazhin tuaj këtu..."
                    value={sendForm.message}
                    onChange={(e) => setSendForm(prev => ({ ...prev, message: e.target.value }))}
                    className="mt-1 h-32"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {sendForm.message.length}/160 karaktere
                  </p>
                </div>
                
                <Button 
                  onClick={sendSms}
                  disabled={sendForm.sending || !sendForm.recipient || !sendForm.message || gatewayStatus === 'offline'}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {sendForm.sending ? 'Duke dërguar...' : 'Dërgo SMS'}
                </Button>

                {gatewayStatus === 'offline' && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">
                      Gateway nuk është i konfiguruar. 
                      <Button 
                        variant="link" 
                        className="p-0 h-auto text-red-700 underline ml-1"
                        onClick={() => window.location.href = '/sms-config'}
                      >
                        Konfiguroni këtu
                      </Button>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Messages List - Simplified */}
          <div className="lg:col-span-2">
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-gray-800">Historiku i Mesazheve</CardTitle>
                  <Button 
                    onClick={loadMessages}
                    variant="outline"
                    size="sm"
                  >
                    Rifresko
                  </Button>
                </div>
                <p className="text-sm text-gray-600">
                  {messages.length > 0 ? `${messages.length} mesazhe gjithsej (${outboundMessages.length} dërguar, ${inboundMessages.length} marrë)` : 'Nuk ka mesazhe'}
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[500px] overflow-y-auto">
                  {messages.length > 0 ? (
                    messages.map((message) => (
                      <div key={message.id} className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 rounded-full ${
                              message.direction === 'inbound' ? 'bg-purple-500' : 'bg-blue-500'
                            }`}></div>
                            <div>
                              <p className="text-sm font-medium text-gray-800">
                                {message.direction === 'inbound' ? 
                                  `Nga: ${formatPhoneNumber(message.sender || '')}` : 
                                  `Tek: ${formatPhoneNumber(message.recipient || '')}`
                                }
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatDateTime(message.created_at)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-400">
                              {message.direction === 'inbound' ? 'Marrë' : 'Dërguar'}
                            </span>
                            {getStatusBadge(message.status)}
                          </div>
                        </div>
                        <div className={`p-3 rounded-lg ${
                          message.direction === 'inbound' ? 'bg-blue-50 border-l-4 border-blue-400' : 'bg-gray-100 border-l-4 border-gray-400'
                        }`}>
                          <p className="text-sm text-gray-700">
                            {message.message}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <div className="w-8 h-8 bg-gray-300 rounded"></div>
                      </div>
                      <h3 className="text-lg font-medium text-gray-800 mb-2">Nuk ka mesazhe</h3>
                      <p className="text-gray-500">Dërgoni SMS-in e parë tuaj për të filluar</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}