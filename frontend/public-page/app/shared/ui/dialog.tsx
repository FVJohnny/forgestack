'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

// Custom Dialog that closes itself when the user presses the browser back button.
// We only hook into history when the dialog transitions from closed → open via user
// interaction. If the dialog is already open on first mount (e.g. driven by URL state),
// we skip the history dance to avoid racing with React strict-mode double-invoke and
// any concurrent navigation that happens during page hydration.
const Dialog = ({ open, onOpenChange, ...props }: DialogPrimitive.DialogProps) => {
  const onOpenChangeRef = React.useRef(onOpenChange);
  const pushedStateRef = React.useRef(false);
  const wasOpenRef = React.useRef(open);
  const isFirstRunRef = React.useRef(true);

  // Keep onOpenChange ref updated
  React.useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  React.useEffect(() => {
    // Skip the very first effect run if the dialog was already open on mount —
    // there's no closed→open transition to react to, and pushing history here
    // races with strict-mode cleanup (which would queue a history.back() that
    // a remounted listener would catch and immediately close the dialog).
    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
      wasOpenRef.current = open;
      return;
    }

    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;

    // Only attach history handling on a real closed → open transition.
    if (!open || wasOpen) return;

    window.history.pushState({ modal: true }, '');
    pushedStateRef.current = true;

    const handlePopState = () => {
      if (pushedStateRef.current) {
        pushedStateRef.current = false;
        onOpenChangeRef.current?.(false);
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      // If dialog is closing normally (not via back button), go back to remove our history entry
      if (pushedStateRef.current) {
        pushedStateRef.current = false;
        window.history.back();
      }
    };
  }, [open]);

  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} {...props} />;
};

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className = '', ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={`fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 ${className}`}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className = '', children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={`fixed z-50 flex flex-col w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] gap-2 sm:gap-4 border border-line bg-card shadow-2xl shadow-black/50 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0
        left-[50%] translate-x-[-50%]
        top-[50%] translate-y-[-50%] sm:bottom-auto sm:top-[50%] sm:translate-y-[-50%]
        rounded-xl
        p-3 sm:p-6
        max-h-[85vh]
        data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom
        sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%] sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%]
        sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95
        focus:outline-none focus-visible:outline-none
        ${className}`}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-3 top-3 sm:right-4 sm:top-4 z-20 rounded-lg p-2 sm:p-1 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white active:bg-gray-700 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-6 w-6 sm:h-5 sm:w-5" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`flex flex-col space-y-1.5 text-center sm:text-left ${className}`} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className}`}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className = '', ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={`text-lg sm:text-2xl font-bold text-white ${className}`}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className = '', ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={`text-sm text-gray-400 ${className}`}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
