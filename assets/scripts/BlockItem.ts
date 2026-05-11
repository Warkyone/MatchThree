import { _decorator, Component, Sprite, SpriteFrame } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('BlockItem')
export class BlockItem extends Component {
    @property(SpriteFrame) blockFrames: SpriteFrame[] = [];
    type = 0;
    x = 0;
    y = 0;

    setType(t: number) {
        this.type = t;
        this.getComponent(Sprite)!.spriteFrame = this.blockFrames[t];// 设置不同颜色
    }
}