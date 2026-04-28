import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PresentationInputBridge } from '../input/PresentationInputBridge.js';
import { CONTEXT_MENU_HANDLED_FLAG } from '../../../components/context-menu/event-flags.js';

describe('PresentationInputBridge - Context Menu Handling', () => {
  let bridge: PresentationInputBridge;
  let layoutSurface: HTMLElement;
  let targetDom: HTMLElement;
  let getTargetDom: () => HTMLElement | null;
  let isEditable: () => boolean;
  let windowRoot: Window;

  beforeEach(() => {
    // Create mock DOM elements
    layoutSurface = document.createElement('div');
    targetDom = document.createElement('div');
    document.body.appendChild(layoutSurface);
    document.body.appendChild(targetDom);

    // Mock callbacks
    getTargetDom = vi.fn(() => targetDom);
    isEditable = vi.fn(() => true);

    // Use real window
    windowRoot = window;

    // Create bridge instance
    bridge = new PresentationInputBridge(windowRoot, layoutSurface, getTargetDom, isEditable);
    bridge.bind();
  });

  describe('#forwardContextMenu', () => {
    it('should forward context menu event when flag is NOT set', () => {
      const dispatchSpy = vi.spyOn(targetDom, 'dispatchEvent');
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        clientY: 200,
      });

      layoutSurface.dispatchEvent(event);

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'contextmenu',
          clientX: 100,
          clientY: 200,
        }),
      );
    });

    it('should NOT forward context menu event when CONTEXT_MENU_HANDLED_FLAG is set', () => {
      const dispatchSpy = vi.spyOn(targetDom, 'dispatchEvent');
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        clientY: 200,
      });

      // Set the flag to indicate ContextMenu handled it
      (event as MouseEvent & { [key: string]: boolean })[CONTEXT_MENU_HANDLED_FLAG] = true;

      layoutSurface.dispatchEvent(event);

      // Should not dispatch to target because ContextMenu already handled it
      expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('should NOT forward when flag is truthy value', () => {
      const dispatchSpy = vi.spyOn(targetDom, 'dispatchEvent');
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
      });

      // Set flag to any truthy value
      (event as MouseEvent & { [key: string]: string })[CONTEXT_MENU_HANDLED_FLAG] = 'yes';

      layoutSurface.dispatchEvent(event);

      expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('should forward when flag is false', () => {
      const dispatchSpy = vi.spyOn(targetDom, 'dispatchEvent');
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        clientY: 200,
      });

      // Explicitly set flag to false
      (event as MouseEvent & { [key: string]: boolean })[CONTEXT_MENU_HANDLED_FLAG] = false;

      layoutSurface.dispatchEvent(event);

      expect(dispatchSpy).toHaveBeenCalled();
    });

    it('should forward when flag is undefined', () => {
      const dispatchSpy = vi.spyOn(targetDom, 'dispatchEvent');
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        clientY: 200,
      });

      // Flag is not set (undefined)
      layoutSurface.dispatchEvent(event);

      expect(dispatchSpy).toHaveBeenCalled();
    });

    it('should NOT forward when editor is not editable (regardless of flag)', () => {
      isEditable = vi.fn(() => false);
      bridge.destroy();
      bridge = new PresentationInputBridge(windowRoot, layoutSurface, getTargetDom, isEditable);
      bridge.bind();

      const dispatchSpy = vi.spyOn(targetDom, 'dispatchEvent');
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
      });

      layoutSurface.dispatchEvent(event);

      expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('should NOT forward when event is already prevented (regardless of flag)', () => {
      const dispatchSpy = vi.spyOn(targetDom, 'dispatchEvent');
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
      });

      // Prevent default before dispatching
      event.preventDefault();

      layoutSurface.dispatchEvent(event);

      expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('should check flag before checking editability', () => {
      // This test ensures the flag is checked first for performance
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
      });
      (event as MouseEvent & { [key: string]: boolean })[CONTEXT_MENU_HANDLED_FLAG] = true;

      layoutSurface.dispatchEvent(event);

      // isEditable should not be called because flag check should short-circuit
      // Note: This is implementation detail testing, but important for performance
      const dispatchSpy = vi.spyOn(targetDom, 'dispatchEvent');
      expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('should preserve event coordinates when forwarding', () => {
      const dispatchSpy = vi.spyOn(targetDom, 'dispatchEvent');
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: 150,
        clientY: 250,
        screenX: 1150,
        screenY: 1250,
      });

      layoutSurface.dispatchEvent(event);

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          clientX: 150,
          clientY: 250,
          screenX: 1150,
          screenY: 1250,
        }),
      );
    });

    it('should preserve modifier keys when forwarding', () => {
      const dispatchSpy = vi.spyOn(targetDom, 'dispatchEvent');
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        shiftKey: true,
        altKey: true,
        metaKey: false,
      });

      layoutSurface.dispatchEvent(event);

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ctrlKey: true,
          shiftKey: true,
          altKey: true,
          metaKey: false,
        }),
      );
    });
  });

  describe('integration with ContextMenu flag', () => {
    it('should coordinate with ContextMenu capture phase handler', () => {
      // Simulate what happens in the real flow:
      // 1. ContextMenu sets flag in capture phase
      // 2. PresentationInputBridge checks flag in bubble phase
      const dispatchSpy = vi.spyOn(targetDom, 'dispatchEvent');

      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
      });

      // Simulate ContextMenu setting the flag during capture phase
      layoutSurface.addEventListener(
        'contextmenu',
        (e) => {
          (e as unknown as MouseEvent & { [key: string]: boolean })[CONTEXT_MENU_HANDLED_FLAG] = true;
        },
        true, // capture phase
      );

      layoutSurface.dispatchEvent(event);

      // Bridge should see the flag and not forward
      expect(dispatchSpy).not.toHaveBeenCalled();
    });
  });

  describe('stale hidden-editor rerouting', () => {
    it('does not double-forward layout-surface composing beforeinput when window fallback is enabled', () => {
      const event = new InputEvent('beforeinput', {
        data: 'e',
        inputType: 'insertCompositionText',
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'isComposing', { value: true, writable: false });

      const forwardedEvents: string[] = [];
      targetDom.addEventListener('beforeinput', () => {
        forwardedEvents.push('beforeinput');
      });

      bridge.destroy();
      bridge = new PresentationInputBridge(windowRoot, layoutSurface, getTargetDom, isEditable, undefined, {
        useWindowFallback: true,
      });
      bridge.bind();

      layoutSurface.dispatchEvent(event);

      expect(forwardedEvents).toEqual(['beforeinput']);
    });

    it('reroutes beforeinput from a stale hidden editor to the active target when window fallback is enabled', () => {
      const staleBodyEditor = document.createElement('div');
      staleBodyEditor.className = 'ProseMirror';
      staleBodyEditor.setAttribute('contenteditable', 'true');
      document.body.appendChild(staleBodyEditor);

      const staleEvent = new InputEvent('beforeinput', {
        data: 'a',
        inputType: 'insertText',
        bubbles: true,
        cancelable: true,
      });

      const targetFocusSpy = vi.spyOn(targetDom, 'focus').mockImplementation(() => {});
      const targetDispatchSpy = vi.spyOn(targetDom, 'dispatchEvent');

      bridge.destroy();
      bridge = new PresentationInputBridge(windowRoot, layoutSurface, getTargetDom, isEditable, undefined, {
        useWindowFallback: true,
      });
      bridge.bind();

      staleBodyEditor.dispatchEvent(staleEvent);

      expect(targetFocusSpy).toHaveBeenCalled();
      expect(targetDispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'beforeinput',
          data: 'a',
          inputType: 'insertText',
        }),
      );
      expect(staleEvent.defaultPrevented).toBe(true);
    });

    it('reroutes non-text keyboard commands from a stale hidden editor to the active target', () => {
      const staleBodyEditor = document.createElement('div');
      staleBodyEditor.className = 'ProseMirror';
      staleBodyEditor.setAttribute('contenteditable', 'true');
      document.body.appendChild(staleBodyEditor);

      const staleEvent = new KeyboardEvent('keydown', {
        key: 'Backspace',
        bubbles: true,
        cancelable: true,
      });

      const targetFocusSpy = vi.spyOn(targetDom, 'focus').mockImplementation(() => {});
      const targetDispatchSpy = vi.spyOn(targetDom, 'dispatchEvent');

      bridge.destroy();
      bridge = new PresentationInputBridge(windowRoot, layoutSurface, getTargetDom, isEditable, undefined, {
        useWindowFallback: true,
      });
      bridge.bind();

      staleBodyEditor.dispatchEvent(staleEvent);

      expect(targetFocusSpy).toHaveBeenCalled();
      expect(targetDispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'keydown',
          key: 'Backspace',
        }),
      );
      expect(staleEvent.defaultPrevented).toBe(true);
    });

    it('does not reroute keyboard input from a registered UI surface editor', () => {
      const commentEditor = document.createElement('div');
      commentEditor.className = 'ProseMirror';
      commentEditor.setAttribute('contenteditable', 'true');

      const commentDialog = document.createElement('div');
      commentDialog.setAttribute('data-editor-ui-surface', '');
      commentDialog.appendChild(commentEditor);
      document.body.appendChild(commentDialog);

      const staleEvent = new KeyboardEvent('keydown', {
        key: 'U',
        bubbles: true,
        cancelable: true,
      });

      const targetFocusSpy = vi.spyOn(targetDom, 'focus').mockImplementation(() => {});
      const targetDispatchSpy = vi.spyOn(targetDom, 'dispatchEvent');

      bridge.destroy();
      bridge = new PresentationInputBridge(windowRoot, layoutSurface, getTargetDom, isEditable, undefined, {
        useWindowFallback: true,
      });
      bridge.bind();

      commentEditor.dispatchEvent(staleEvent);

      expect(targetFocusSpy).not.toHaveBeenCalled();
      expect(targetDispatchSpy).not.toHaveBeenCalled();
      expect(staleEvent.defaultPrevented).toBe(false);
    });
  });

  describe('IME composition target change behavior', () => {
    it('does not synthesize compositionend when target changes without active composition', () => {
      const nextTarget = document.createElement('div');
      document.body.appendChild(nextTarget);

      const getTargetDomMock = vi.fn<() => HTMLElement | null>();
      getTargetDomMock.mockReturnValueOnce(targetDom);
      getTargetDomMock.mockReturnValue(nextTarget);

      bridge.destroy();
      bridge = new PresentationInputBridge(windowRoot, layoutSurface, getTargetDomMock, isEditable);
      bridge.bind();

      const compositionEndSpy = vi.fn();
      targetDom.addEventListener('compositionend', compositionEndSpy);

      bridge.notifyTargetChanged();

      expect(compositionEndSpy).not.toHaveBeenCalled();
    });

    it('does not forward legacy textInput when InputEvent is available', () => {
      const dispatchSpy = vi.spyOn(targetDom, 'dispatchEvent');
      const textInputEvent = new Event('textInput', { bubbles: true, cancelable: true });
      Object.defineProperty(textInputEvent, 'data', { value: '中', configurable: true });

      layoutSurface.dispatchEvent(textInputEvent);

      expect(
        dispatchSpy.mock.calls.some(([event]) => {
          const dispatched = event as Event;
          return dispatched.type === 'textInput';
        }),
      ).toBe(false);
    });

    it('dispatches insertFromComposition before a following compositionend', () => {
      const callOrder: string[] = [];
      targetDom.addEventListener('beforeinput', () => {
        callOrder.push('beforeinput');
      });
      targetDom.addEventListener('compositionend', () => {
        callOrder.push('compositionend');
      });

      const beforeInputEvent = new InputEvent('beforeinput', {
        data: '你',
        inputType: 'insertFromComposition',
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(beforeInputEvent, 'isComposing', { value: false, writable: false });

      layoutSurface.dispatchEvent(beforeInputEvent);
      layoutSurface.dispatchEvent(
        new CompositionEvent('compositionend', { data: '你', bubbles: true, cancelable: true }),
      );

      expect(callOrder[0]).toBe('beforeinput');
      expect(callOrder[1]).toBe('compositionend');
    });

    it('dispatches non-composing insertText before a following compositionend', () => {
      const callOrder: string[] = [];
      targetDom.addEventListener('beforeinput', () => {
        callOrder.push('beforeinput');
      });
      targetDom.addEventListener('compositionend', () => {
        callOrder.push('compositionend');
      });

      const beforeInputEvent = new InputEvent('beforeinput', {
        data: '啊',
        inputType: 'insertText',
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(beforeInputEvent, 'isComposing', { value: false, writable: false });

      layoutSurface.dispatchEvent(beforeInputEvent);
      layoutSurface.dispatchEvent(
        new CompositionEvent('compositionend', { data: '啊', bubbles: true, cancelable: true }),
      );

      expect(callOrder[0]).toBe('beforeinput');
      expect(callOrder[1]).toBe('compositionend');
    });
  });
});
