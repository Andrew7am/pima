import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { webPushAvailable, webPushState, enableWebPush, disableWebPush, WebPushState } from '../lib/push';

/**
 * The browser-notifications opt-in, self-contained so it can live in all three
 * settings screens — guest (ProfileScreen), owner (OwnerDashboardShell) and
 * admin (AdminDashboard).
 *
 * It was originally inline in ProfileScreen only, which meant an owner or an
 * admin — the two people who most need to hear about a new booking or a
 * payment while the tab is closed — had no way to turn push on at all. The
 * switch has to render inside each screen's own visual language, so this takes
 * a `render` prop rather than importing any one screen's ToggleRow.
 *
 * All the awkward parts of the browser API live here once:
 *  - `available` is false in the native app and wherever it cannot work, so
 *    the caller can hide the row rather than show a switch that does nothing.
 *  - `state` reads a local flag, not Notification.permission — see lib/push:
 *    permission cannot be revoked from JS, so "off" removes this browser's
 *    token and the flag is what remembers that.
 */

export interface WebPushRenderArgs {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  checked: boolean;
  busy: boolean;
  /** True only when the browser itself has blocked notifications — the switch
   *  cannot act, and the sublabel tells the user to fix it in site settings. */
  disabled: boolean;
  onChange: (next: boolean) => void;
}

interface WebPushToggleProps {
  userId: string;
  /** Draws the row in the host screen's own style. Not rendered at all when
   *  web push is unavailable. */
  render: (args: WebPushRenderArgs) => React.ReactNode;
}

export default function WebPushToggle({ userId, render }: WebPushToggleProps) {
  const available = webPushAvailable();
  const [state, setState] = useState<WebPushState>(() => webPushState());
  const [busy, setBusy] = useState(false);

  if (!available) return null;

  const onChange = async (next: boolean) => {
    setBusy(true);
    try {
      if (next) {
        setState(await enableWebPush(userId));
      } else {
        await disableWebPush();
        // Permission survives; only this browser's token is gone. The switch
        // reads our own flag, not Notification.permission, so set it here.
        setState('default');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {render({
        icon: <Bell className="w-[18px] h-[18px]" />,
        label: 'إشعارات المتصفح',
        sublabel:
          state === 'granted' ? 'شغّالة — هتوصلك والموقع مقفول'
            : state === 'denied' ? 'المتصفح رافض — فعّلها من إعدادات الموقع'
            : 'شغّلها توصلك وأنت بره الموقع',
        checked: state === 'granted',
        busy,
        disabled: state === 'denied',
        onChange,
      })}
    </>
  );
}
