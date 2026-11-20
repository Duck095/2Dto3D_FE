import assert from 'node:assert/strict';
import test from 'node:test';
import {
    DEFAULT_STUDIO_SIDEBAR_WIDTH,
    getStudioSidebarBounds,
    clampStudioSidebarWidth,
    readStudioSidebarWidth,
    writeStudioSidebarWidth,
    readStudioSidebarCollapsed,
    writeStudioSidebarCollapsed,
    getStudioSidebarKeyboardWidth,
} from './resizableSidebar.js';

test('sidebar width limits use workspace width and preserve a usable viewer area', () => {
    const bounds = getStudioSidebarBounds(1600, 18);
    assert.deepEqual(bounds, { min: 272, max: 800 });
    assert.equal(clampStudioSidebarWidth(1200, 1600, 18), 800);
    assert.equal(clampStudioSidebarWidth(220, 1600, 18), 272);
    assert.equal(clampStudioSidebarWidth(440, 900, 18), 272);
    assert.ok(getStudioSidebarBounds(900, 18).max <= 450);
    assert.ok(900 - getStudioSidebarBounds(900, 18).max - 18 - 250 >= 360);
});

test('desktop sidebar bounds reserve the history panel and 360px viewer at each layout breakpoint', () => {
    for (const [workspaceWidth, historyWidth] of [[1024, 220], [1199, 220], [1200, 250], [1440, 250]]) {
        const bounds = getStudioSidebarBounds(workspaceWidth, 16, historyWidth);
        assert.ok(workspaceWidth - bounds.max - 16 - historyWidth >= 360,
            `viewer minimum was not reserved at ${workspaceWidth}px`);
        assert.ok(bounds.max <= workspaceWidth * 0.5);
    }
});

test('sidebar stays capped at 960px and preserves the viewer minimum on wide workspaces', () => {
    for (const workspaceWidth of [1366, 1920, 2560, 3840]) {
        const bounds = getStudioSidebarBounds(workspaceWidth, 16);
        assert.equal(bounds.min, 272);
        assert.ok(bounds.max <= 960, `sidebar max at ${workspaceWidth}px was ${bounds.max}`);
        assert.ok(bounds.max <= workspaceWidth * 0.5);
        assert.ok(workspaceWidth - bounds.max - 16 - 250 >= 360);
    }

    assert.equal(getStudioSidebarBounds(1366, 16).max, 683);
    assert.equal(getStudioSidebarBounds(1920, 16).max, 960);
    assert.equal(getStudioSidebarBounds(2560, 16).max, 960);
    assert.equal(getStudioSidebarBounds(3840, 16).max, 960);
});

test('a preferred width is clamped on a narrow viewport and restored when space returns', () => {
    const preferredWidth = 900;
    const narrowWidth = clampStudioSidebarWidth(preferredWidth, 1000, 16);
    const wideWidth = clampStudioSidebarWidth(preferredWidth, 2560, 16);

    assert.ok(narrowWidth < preferredWidth);
    assert.equal(wideWidth, preferredWidth);
});

test('saved sidebar width is accepted only when it is a finite in-range number', () => {
    const storage = { getItem: () => '444' };
    assert.equal(readStudioSidebarWidth(storage), 444);
    for (const raw of [null, '', 'NaN', 'Infinity', '-10', '2001']) {
        assert.equal(readStudioSidebarWidth({ getItem: () => raw }), DEFAULT_STUDIO_SIDEBAR_WIDTH);
    }
    assert.equal(readStudioSidebarWidth({ getItem: () => { throw new Error('storage blocked'); } }), DEFAULT_STUDIO_SIDEBAR_WIDTH);
});

test('sidebar width persistence validates values and handles storage failures safely', () => {
    let saved = null;
    const storage = { setItem: (key, value) => { saved = [key, value]; } };
    assert.equal(writeStudioSidebarWidth(storage, 420), true);
    assert.deepEqual(saved, ['2dto3d.ai-studio.sidebar-width', '420']);
    assert.equal(writeStudioSidebarWidth(storage, 100), false);
    assert.equal(writeStudioSidebarWidth(undefined, 420), false);
    assert.equal(writeStudioSidebarWidth({ setItem: () => { throw new Error('storage blocked'); } }, 420), false);
});

test('collapsed preference persists independently from the saved sidebar width', () => {
    let saved;
    const storage = {
        getItem: key => key === '2dto3d.ai-studio.sidebar-collapsed' ? saved?.[1] ?? null : '444',
        setItem: (key, value) => { saved = [key, value]; },
    };
    assert.equal(readStudioSidebarCollapsed(storage), false);
    assert.equal(writeStudioSidebarCollapsed(storage, true), true);
    assert.deepEqual(saved, ['2dto3d.ai-studio.sidebar-collapsed', 'true']);
    assert.equal(readStudioSidebarCollapsed(storage), true);
    assert.equal(readStudioSidebarWidth(storage), 444);
    assert.equal(writeStudioSidebarCollapsed(undefined, true), false);
    assert.equal(readStudioSidebarCollapsed({ getItem: () => { throw new Error('storage blocked'); } }), false);
});

test('keyboard resizing follows the horizontal axis and respects the measured limits', () => {
    const bounds = { min: 272, max: 800 };
    assert.equal(getStudioSidebarKeyboardWidth(360, 'ArrowLeft', bounds), 344);
    assert.equal(getStudioSidebarKeyboardWidth(360, 'ArrowRight', bounds), 376);
    assert.equal(getStudioSidebarKeyboardWidth(360, 'Home', bounds), 272);
    assert.equal(getStudioSidebarKeyboardWidth(360, 'End', bounds), 800);
    assert.equal(getStudioSidebarKeyboardWidth(272, 'ArrowLeft', bounds), 272);
    assert.equal(getStudioSidebarKeyboardWidth(800, 'ArrowRight', bounds), 800);
    assert.equal(getStudioSidebarKeyboardWidth(360, 'ArrowUp', bounds), null);
});
