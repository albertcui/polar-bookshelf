import {IBlock} from "./IBlock";
import {SetArrays} from "polar-shared/src/util/SetArrays";
import {arrayStream} from "polar-shared/src/util/ArrayStreams";
import {BlockIDStr, BlocksStore} from "./BlocksStore";
import {Block} from "./Block";
import deepEqual from "deep-equal";
import { Arrays } from "polar-shared/src/util/Arrays";

export namespace BlocksStoreUndoQueues {

    // FIXME: have tests for this... that uses the BlocksStore directly..

    export interface IUndoMutation {
        readonly parent: IBlock | undefined;
        readonly child: IBlock;
    }

    export type BlockUpdateMutationType = 'updated' | 'added' | 'removed';

    export interface IBlocksStoreMutation {
        readonly type: BlockUpdateMutationType;
        readonly block: IBlock;
    }

    export interface IUndoCapture {
        readonly prepare: (snapshot: ReadonlyArray<Block>) => void;
        readonly capture: (snapshot: ReadonlyArray<Block>) => ReadonlyArray<IBlocksStoreMutation>;
    }

    // FIXME move everything that uses BlocksStore into BlocksStore
    // FIXME: aprent operations have to behave properly

    export interface IUndoCaptureOpts {
        readonly noExpand?: boolean;
    }


    /**
     * Perform an undo capture for the following identifiers based on their
     * parent
     */
    export function createUndoCapture(blocksStore: BlocksStore, identifiers: ReadonlyArray<BlockIDStr>): IUndoCapture {

        let prepared: boolean = false;

        let beforeBlocks: ReadonlyArray<IBlock> = [];

        identifiers = expandToParentAndChildren(blocksStore, identifiers);

        /**
         * Computes only the blocks that are applicable to this operation.  We
         * have to know all the block IDs that would be involved with this
         * transaction.
         */
        const computeBlocks = (blocks: ReadonlyArray<Block>) => {

            return blocks.filter(block => identifiers.includes(block.id))
                         .map(block => block.toJSON());

        }

        const prepare = (snapshot: ReadonlyArray<Block>) => {

            prepared = true;
            beforeBlocks = computeBlocks(snapshot)

        };

        const capture = (snapshot: ReadonlyArray<Block>) => {

            if (! prepared) {
                throw new Error("Not prepared");
            }

            const afterBlocks = computeBlocks(snapshot);

            return computeUndoMutations(beforeBlocks, afterBlocks);

        }

        return {capture, prepare};

    }

    export function applyUndoMutations(blocksStore: BlocksStore, mutations: ReadonlyArray<IBlocksStoreMutation>) {

        // TODO: we might not need to mutate something if it hasn't actually
        // changed and we can look at 'updated' for this

        const handleUpdated = (mutation: IBlocksStoreMutation) => {

            // updated means we need to restore it to the older version.

            const block = blocksStore.getBlock(mutation.block.id);

            if (! block) {
                throw new Error("Block mot currently in store: " + mutation.block.id)
            }

            block.set(mutation.block);

        }

        const handleAdded = (mutation: IBlocksStoreMutation) => {

            // added means we have to remove it now...

            if (blocksStore.containsBlock(mutation.block.id)) {
                blocksStore.doDelete([mutation.block.id]);
            } else {
                throw new Error("Block missing: " + mutation.block.id)
            }

        }

        const handleRemoved = (mutation: IBlocksStoreMutation) => {

            // added means we have to remove it now...

            if (! blocksStore.containsBlock(mutation.block.id)) {
                blocksStore.doPut([mutation.block]);
            } else {
                throw new Error("Block already exists: " + mutation.block.id)
            }

        }

        for(const mutation of mutations) {

            switch (mutation.type) {

                case "updated":
                    handleUpdated(mutation);
                    break;

                case "added":
                    handleAdded(mutation);
                    break;

                case "removed":
                    handleRemoved(mutation);
                    break;

            }

        }

    }

    export function computeUndoMutations(beforeBlocks: ReadonlyArray<IBlock>,
                                         afterBlocks: ReadonlyArray<IBlock>): ReadonlyArray<IBlocksStoreMutation> {

        const afterBlockIndex = arrayStream(afterBlocks).toMap();
        const beforeBlockIndex = arrayStream(beforeBlocks).toMap();

        const beforeBlockIDs = beforeBlocks.map(current => current.id);
        const afterBlockIDs = afterBlocks.map(current => current.id);

        const added = SetArrays.difference(afterBlockIDs, beforeBlockIDs)
                               .map(id => afterBlockIndex[id]);

        const removed = SetArrays.difference(beforeBlockIDs, afterBlockIDs)
                                 .map(id => beforeBlockIndex[id]);

        const computeUpdated = () => {

            const isUpdated = (beforeBlock: IBlock) => {

                const afterBlock = afterBlockIndex[beforeBlock.id];
                if ( afterBlock) {
                    return afterBlock.updated !== beforeBlock.updated;
                }

                return false;

            }

            return beforeBlocks.filter(isUpdated)

        }

        const updated = computeUpdated();

        const toMutation = (block: IBlock, type: BlockUpdateMutationType): IBlocksStoreMutation => {
            return {block, type};

        }

        return [
            ...updated.map(current => toMutation(current, 'updated')),
            ...added.map(current => toMutation(current, 'added')),
            ...removed.map(current => toMutation(current, 'removed'))
        ];

    }

    /**
     *
     * For a given ID, compute all the blocks that could be involved in a
     * mutation including the immediate parents and all the children, the
     * identifiers, themselves, and all the descendants.
     *
     */
    export function expandToParentAndChildren(blocksStore: BlocksStore, identifiers: ReadonlyArray<BlockIDStr>): ReadonlyArray<BlockIDStr> {

        const computeChildren = (identifiers: ReadonlyArray<BlockIDStr>) => {

            const computeChildrenForBlock = (id: BlockIDStr): ReadonlyArray<BlockIDStr> => {

                const items = blocksStore.getBlock(id)?.items || [];

                const descendants = arrayStream(items)
                    .map(current => computeChildrenForBlock(current))
                    .flatMap(current => current)
                    .collect();

                return [
                    ...items,
                    ...descendants
                ];

            }

            return arrayStream(identifiers)
                    .map(current => computeChildrenForBlock(current))
                    .flatMap(current => current)
                    .unique()
                    .collect();
        }

        const children = computeChildren(identifiers);

        const computeParents = (identifiers: ReadonlyArray<BlockIDStr>): ReadonlyArray<BlockIDStr> => {

            const getParent = (id: BlockIDStr): BlockIDStr | undefined => {
                return blocksStore.getBlock(id)?.parent;
            }

            return arrayStream(identifiers)
                .map(current => getParent(current))
                .filterPresent()
                .collect();

        }

        const primaryBlockIdentifiers
            = arrayStream([...identifiers, ...children])
                .unique()
                .collect();

        const parents = computeParents(primaryBlockIdentifiers);

        return arrayStream([...identifiers, ...children, ...parents])
                .unique()
                .collect();

    }

    /**
     *
     * The mutation types:
     *
     * - items: the items were changes which means that we have to issue a patch
     *          to undo it to avoid conflicting with another users edits on the
     *          children.
     *
     * - content: the content was changed.
     *
     * - items-and-content: both the items and content were changed.
     *
     */
    export type MutationType = 'items' | 'content' | 'items-and-content';

    /**
     * Given a before block, and an after block, compute the mutations that were
     * performed on the content.
     */
    export function computeMutationType(before: IBlock, after: IBlock): MutationType {

        // FIXME for 'items' we also have to compute a diff and a before / after
        // mutation set including 'remove' and 'insert'

        const itemsMuted = ! deepEqual(before.items, after.items);
        const contentMuted = ! deepEqual(before.content, after.content);

        if (itemsMuted && contentMuted) {
            return 'items-and-content';
        } else if (itemsMuted) {
            return 'items';
        } else  {
            return 'content';
        }

    }

    /**
     * Instruction to remove and item from the items.
     */
    export interface IItemsPatchRemove {
        readonly type: 'remove';
        readonly id: BlockIDStr;
    }

    export interface IItemsPatchInsert {
        readonly type: 'insert';
        readonly ref: BlockIDStr;
        readonly id: BlockIDStr
        readonly pos: 'after' | 'before';
    }

    export interface IItemsPatchUnshift {
        readonly type: 'unshift';
        readonly id: BlockIDStr;
    }

    export type IItemsPatch = IItemsPatchRemove | IItemsPatchInsert | IItemsPatchUnshift;

    export function computeItemsPatch(before: ReadonlyArray<BlockIDStr>, after: ReadonlyArray<BlockIDStr>): ReadonlyArray<IItemsPatch> {

        const removed = SetArrays.difference(before, after);
        const added = SetArrays.difference(after, before);

        const toRemoved = (id: BlockIDStr): IItemsPatchRemove => {
            return {
                type: 'remove',
                id
            };
        }

        const toAdded = (id: BlockIDStr): IItemsPatchUnshift | IItemsPatchInsert => {

            if (after.length === 1) {
                return {
                    type: 'unshift',
                    id
                };
            }

            const idx = after.indexOf(id);
            const prevSibling = Arrays.prevSibling(after, idx);
            const nextSibling = Arrays.nextSibling(after, idx);

            if (prevSibling !== undefined) {
                return {
                    type: 'insert',
                    ref: prevSibling,
                    id,
                    pos: 'after'
                };
            }

            if (nextSibling !== undefined) {
                return {
                    type: 'insert',
                    ref: nextSibling,
                    id,
                    pos: 'before'
                };
            }

            throw new Error("Unable to compute patch");

        }

        return [
            ...removed.map(toRemoved),
            ...added.map(toAdded)
        ];

    }

}