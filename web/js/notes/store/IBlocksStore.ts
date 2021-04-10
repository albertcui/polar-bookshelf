import {
    IBlockActivated,
    NavOpts,
    NavPosition,
    BlockIDStr,
    StringSetMap,
    DoIndentResult,
    DoUnIndentResult, ISplitBlock, ICreatedBlock, IActiveBlock, BlockNameStr, IBlockMerge, DoPutOpts, BlocksIndex
} from "./BlocksStore";
import {IBlock} from "./IBlock";
import {Block} from "./Block";
import {BlockTargetStr} from "../NoteLinkLoader";
import {ReverseIndex} from "./ReverseIndex";

export interface IBlocksStore {

    selected: StringSetMap;
    root: BlockIDStr | undefined;
    active: IActiveBlock | undefined;
    dropSource: string | undefined;
    dropTarget: string | undefined;
    reverse: ReverseIndex;
    index: BlocksIndex;

    clearSelected(reason: string): void;
    hasSelected(): boolean;

    lookup(blocks: ReadonlyArray<BlockIDStr>): ReadonlyArray<IBlock>;
    lookupReverse(id: BlockIDStr): ReadonlyArray<BlockIDStr>;
    pathToBlock(id: BlockIDStr): ReadonlyArray<Block>;

    doDelete(blockIDs: ReadonlyArray<BlockIDStr>): void;
    setActive(active: BlockIDStr | undefined): void;

    setRoot(root: BlockIDStr | undefined): void;

    getBlockByTarget(target: BlockIDStr | BlockTargetStr): Block | undefined;

    getBlockActivated(id: BlockIDStr): IBlockActivated | undefined;

    getBlock(id: BlockIDStr): Block | undefined;

    setActiveWithPosition(active: BlockIDStr | undefined,
                          activePos: NavPosition | undefined): void;

    expand(id: BlockIDStr): void;
    collapse(id: BlockIDStr): void;
    toggleExpand(id: BlockIDStr): void;
    setSelectionRange(fromBlock: BlockIDStr, toBlock: BlockIDStr): void;

    isExpanded(id: BlockIDStr): boolean;
    isSelected(id: BlockIDStr): boolean;

    doIndent(id: BlockIDStr): ReadonlyArray<DoIndentResult>;
    doUnIndent(id: BlockIDStr): ReadonlyArray<DoUnIndentResult>;

    requiredAutoUnIndent(id: BlockIDStr): boolean;

    createNewBlock(id: BlockIDStr,
                   split?: ISplitBlock): ICreatedBlock;

    createNewNamedBlock(name: BlockNameStr, ref: BlockIDStr): BlockIDStr;

    filterByName(filter: string): ReadonlyArray<BlockNameStr>;

    clearDrop(): void;

    setDropSource(dropSource: BlockIDStr): void;
    setDropTarget(dropTarget: BlockIDStr): void;

    mergeBlocks(target: BlockIDStr, source: BlockIDStr): void;

    canMerge(id: BlockIDStr): IBlockMerge | undefined;

    navPrev(pos: NavPosition, opts: NavOpts): void;
    navNext(pos: NavPosition, opts: NavOpts): void;

    getNamedNodes(): ReadonlyArray<string>;

    doPut(blocks: ReadonlyArray<IBlock>, opts?: DoPutOpts): void;

}
