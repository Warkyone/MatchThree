import { _decorator, Component, instantiate, Node, view, ResolutionPolicy, input, Input, EventTouch, Vec3 } from 'cc';
import { BlockItem } from './BlockItem';
const { ccclass, property } = _decorator;

const GRID = 8;             // 棋盘行列数
const BLOCK_SIZE = 60;     // 方块的尺寸
const TYPE_COUNT = 5;      // 颜色种类

@ccclass('MatchThree')
export class MatchThree extends Component {
    @property(Node) blockPrefab: Node = null!;//预制体插槽
    private grid: (BlockItem | null)[][] = Array(GRID).fill(null).map(() => Array(GRID).fill(null));
    /** 当前选中 */
    private selected: BlockItem | null = null;
    private isSwapping = false;//交换中不给点

    onLoad() {
        view.setDesignResolutionSize(1280, 720, ResolutionPolicy.FIXED_HEIGHT);//手机上有点小，试试这个

        this.createGrid();
        input.on(Input.EventType.TOUCH_END, this.onTouch, this);
    }

    createGrid() {
        for (let y = 0; y < GRID; y++) {
            for (let x = 0; x < GRID; x++) {
                const node = instantiate(this.blockPrefab);//克隆
                //设置方块
                const block = node.getComponent(BlockItem)!;
                block.x = x;
                block.y = y;
                block.setType(Math.floor(Math.random() * TYPE_COUNT));//颜色随机
                node.setPosition((x - 3.5) * BLOCK_SIZE, (y - 3.5) * BLOCK_SIZE);
                this.node.addChild(node);
                this.grid[y][x] = block;//存入棋盘
            }
        }
    }

    onTouch(e: EventTouch) {
        if (this.isSwapping) return;
        
        const p = e.getUILocation();
        // 屏幕中心点坐标
        const cx = view.getVisibleSize().width / 2;
        const cy = view.getVisibleSize().height / 2;

        //点第几格
        const x = Math.floor((p.x - cx) / BLOCK_SIZE + 4);
        const y = Math.floor((p.y - cy) / BLOCK_SIZE + 4);

        // 越界
        if (x < 0 || x >= GRID || y < 0 || y >= GRID) return;

        const block = this.grid[y][x];
        if (!block) return;

        // 首次选中
        if (!this.selected) {
            this.selected = block;
            block.node.scale = new Vec3(1.2, 1.2, 1);
            return;
        }

        // 相邻交换
        if (this.isNear(block, this.selected)) {
            this.trySwap(block, this.selected);
        }

        this.selected.node.scale = Vec3.ONE;
        this.selected = null;
    }


    isNear(a: BlockItem, b: BlockItem): boolean {
        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);
        return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);//上下或左右
    }


    /**交换 */
    async trySwap(a: BlockItem, b: BlockItem) {
        this.isSwapping = true;

        //原始位置
        const posA = a.node.position.clone();
        const posB = b.node.position.clone();

        // 交换坐标
        this.swapData(a, b);
        a.node.setPosition(posB);
        b.node.setPosition(posA);


        const list = this.getMatchList();
        if (list.length > 0) {
            //连续消除
            await this.matchLoop();
        } else {
            this.swapData(a, b);
            a.node.setPosition(posA);
            b.node.setPosition(posB);
        }

        this.isSwapping = false;
    }

    swapData(a: BlockItem, b: BlockItem) {
        [this.grid[a.y][a.x], this.grid[b.y][b.x]] = [this.grid[b.y][b.x], this.grid[a.y][a.x]];//交换棋盘数据
        [a.x, b.x] = [b.x, a.x];
        [a.y, b.y] = [b.y, a.y];
    }

    /**连续消除循环 */
    async matchLoop() {
        const list = this.getMatchList();
        if (list.length === 0) return;

        //消除掉落补齐
        this.clearAllMatches();
        await this.wait(0.2);

        this.dropBlocks();
        await this.wait(0.2);

        this.fillBlocks();
        await this.wait(0.2);

        //递归
        await this.matchLoop();
    }


    /**可消除方块数组 */
    getMatchList(): BlockItem[] {
        // 去重
        const set = new Set<BlockItem>();

        // 横遍历
        for (let y = 0; y < GRID; y++) {
            for (let x = 0; x <= GRID - 3; x++) {
                const b1 = this.grid[y][x];
                const b2 = this.grid[y][x+1];
                const b3 = this.grid[y][x+2];
                if (!b1 || !b2 || !b3) continue;//空格
                if (b1.type === b2.type && b2.type === b3.type) {
                    set.add(b1);
                    set.add(b2);
                    set.add(b3);
                }
            }
        }

        // 纵向
        for (let x = 0; x < GRID; x++) {
            for (let y = 0; y <= GRID - 3; y++) {
                const b1 = this.grid[y][x];
                const b2 = this.grid[y+1][x];
                const b3 = this.grid[y+2][x];
                if (!b1 || !b2 || !b3) continue;
                if (b1.type === b2.type && b2.type === b3.type) {
                    set.add(b1);
                    set.add(b2);
                    set.add(b3);
                }
            }
        }

        return Array.from(set);
    }

    clearAllMatches() {
        const list = this.getMatchList();
        list.forEach(b => {
            b.node.destroy();
            this.grid[b.y][b.x] = null; //置空
        });
    }

    dropBlocks() {
        for (let x = 0; x < GRID; x++) {
            for (let y = 0; y < GRID; y++) {
                if (!this.grid[y][x]) {//空格子，掉落
                    for (let yy = y + 1; yy < GRID; yy++) {
                        if (this.grid[yy][x]) {//你在上面你掉
                            const b = this.grid[yy][x]!;

                            this.grid[y][x] = b;
                            this.grid[yy][x] = null;
                            
                            b.y = y;
                            b.node.setPosition((x - 3.5) * BLOCK_SIZE, (y - 3.5) * BLOCK_SIZE);//重新设置位置
                            break;
                        }
                    }
                }
            }
        }
    }

    fillBlocks() {
        for (let x = 0; x < GRID; x++) {
            for (let y = 0; y < GRID; y++) {
                if (!this.grid[y][x]) {//空格，生成
                    const node = instantiate(this.blockPrefab);
                    const b = node.getComponent(BlockItem)!;
                    b.x = x;
                    b.y = y;
                    b.setType(Math.floor(Math.random() * TYPE_COUNT));
                    node.setPosition((x - 3.5) * BLOCK_SIZE, (y - 3.5) * BLOCK_SIZE);
                    this.node.addChild(node);
                    this.grid[y][x] = b;
                }
            }
        }
    }

    wait(s: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, s * 1000));
    }
}