import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { 
  Menu,
  Home,
  Trophy,
  Swords,
  Calendar as CalendarIcon,
  FileText,
  BarChart3,
  User,
  Settings,
  Shield
} from 'lucide-react';

const HeaderMenu: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (user) {
      checkAdminStatus();
    }
  }, [user]);

  const checkAdminStatus = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('user_id', user?.id)
        .single();
      
      setIsAdmin(data?.is_admin || false);
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const menuItems = [
    { title: 'Dashboard', url: '/', icon: Home },
    { title: 'Classifica', url: '/ranking', icon: Trophy },
    { title: 'Sfide', url: '/challenges', icon: Swords },
    { title: 'Calendario', url: '/calendar', icon: CalendarIcon },
    { title: 'Risultati Partite', url: '/match-results', icon: FileText },
    { title: 'Le Mie Statistiche', url: '/statistics', icon: BarChart3 },
  ];

  const userItems = [
    { title: 'Profilo', url: '/profile', icon: User },
    { title: 'Impostazioni', url: '/settings', icon: Settings },
  ];

  const adminItems = [
    { title: 'Pannello Admin', url: '/admin', icon: Shield },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-tennis-court hover:bg-tennis-court/10">
          <Menu className="h-6 w-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 bg-card/95 backdrop-blur-sm z-[100]">
        {menuItems.map((item) => (
          <DropdownMenuItem key={item.url} asChild>
            <Link to={item.url} className="flex items-center gap-3 cursor-pointer">
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </Link>
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator />
        
        {userItems.map((item) => (
          <DropdownMenuItem key={item.url} asChild>
            <Link to={item.url} className="flex items-center gap-3 cursor-pointer">
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </Link>
          </DropdownMenuItem>
        ))}
        
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            {adminItems.map((item) => (
              <DropdownMenuItem key={item.url} asChild>
                <Link to={item.url} className="flex items-center gap-3 cursor-pointer">
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default HeaderMenu;
