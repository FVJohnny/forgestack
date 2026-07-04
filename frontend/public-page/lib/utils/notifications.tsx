import { toast } from 'sonner';
import { CheckCircle, XCircle, AlertTriangle, Info, X, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

const baseStyle = {
  background: 'linear-gradient(135deg, #0a0a0a 0%, #171717 100%)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  color: '#fff',
  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
  cursor: 'pointer',
};

const variantStyles = {
  success: {
    ...baseStyle,
    border: '1px solid rgba(34, 197, 94, 0.3)',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(34, 197, 94, 0.1)',
  },
  error: {
    ...baseStyle,
    border: '1px solid rgba(239, 68, 68, 0.3)',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(239, 68, 68, 0.1)',
  },
  warning: {
    ...baseStyle,
    border: '1px solid rgba(234, 179, 8, 0.3)',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(234, 179, 8, 0.1)',
  },
  info: {
    ...baseStyle,
    border: '1px solid rgba(59, 130, 246, 0.3)',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(59, 130, 246, 0.1)',
  },
};

const variantIcons: Record<string, { Icon: LucideIcon; color: string }> = {
  success: { Icon: CheckCircle, color: 'text-green-400' },
  error: { Icon: XCircle, color: 'text-red-400' },
  warning: { Icon: AlertTriangle, color: 'text-yellow-400' },
  info: { Icon: Info, color: 'text-blue-400' },
};

interface NotifyOptions {
  title: string;
  description?: string;
  duration?: number;
  icon?: ReactNode;
}

function createNotification(variant: keyof typeof variantStyles, options: NotifyOptions | string) {
  const opts = typeof options === 'string' ? { title: options } : options;
  const { title, description, duration = 4000, icon } = opts;
  const { Icon, color } = variantIcons[variant];

  const toastId = toast.custom(
    (id) => (
      <div
        onClick={() => toast.dismiss(id)}
        className="flex items-start gap-3 w-full p-4 rounded-lg"
        style={variantStyles[variant]}
      >
        <div className={`mt-0.5 flex-shrink-0 ${color}`}>
          {icon || <Icon className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white">{title}</p>
          {description && <p className="text-sm text-gray-300 mt-0.5">{description}</p>}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            toast.dismiss(id);
          }}
          className="flex-shrink-0 text-gray-400 hover:text-white transition-colors p-1 -m-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    ),
    {
      duration,
    },
  );

  return toastId;
}

export const notify = {
  success: (options: NotifyOptions | string) => createNotification('success', options),
  error: (options: NotifyOptions | string) => createNotification('error', options),
  warning: (options: NotifyOptions | string) => createNotification('warning', options),
  info: (options: NotifyOptions | string) => createNotification('info', options),
  motd: (content: string, title = 'Message of the Day') => {
    const { Icon, color } = variantIcons.info;
    return toast.custom(
      (id) => (
        <div
          onClick={() => toast.dismiss(id)}
          className="flex items-start gap-3 w-full sm:w-[420px] p-4 rounded-lg cursor-pointer"
          style={variantStyles.info}
        >
          <div className={`mt-0.5 flex-shrink-0 ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white mb-2">{title}</p>
            <div className="max-h-[60vh] sm:max-h-[300px] overflow-y-auto">
              <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">{content}</p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toast.dismiss(id);
            }}
            className="flex-shrink-0 text-gray-400 hover:text-white transition-colors p-1 -m-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ),
      {
        duration: 10000,
      },
    );
  },
};

// Convenience methods for common use cases
export const notifications = {
  saved: (what?: string) =>
    notify.success({
      title: what ? `${what} Saved` : 'Saved Successfully',
    }),

  deleted: (what?: string) =>
    notify.success({
      title: what ? `${what} Deleted` : 'Deleted Successfully',
    }),

  error: (message?: string) =>
    notify.error({
      title: 'Something went wrong',
      description: message || 'Please try again later.',
    }),

  networkError: () =>
    notify.error({
      title: 'Connection Error',
      description: 'Please check your internet connection.',
    }),

  copied: (what?: string) =>
    notify.success({
      title: what ? `${what} Copied` : 'Copied to Clipboard',
      duration: 2000,
    }),
};
