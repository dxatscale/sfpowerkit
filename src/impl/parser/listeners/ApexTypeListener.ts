import {
    ApexParserListener,
    AnnotationContext,
    InterfaceDeclarationContext,
    ClassDeclarationContext,
} from 'apex-parser';

export default class ApexTypeListener implements ApexParserListener {
    private apexType: ApexType = {
        class: false,
        testClass: false,
        interface: false,
    };

    enterAnnotation(ctx: AnnotationContext): void {
        if (ctx.text.toUpperCase().startsWith('@ISTEST')) {
            this.apexType['testClass'] = true;
        }
    }

    enterInterfaceDeclaration(ctx: InterfaceDeclarationContext): void {
        this.apexType['interface'] = true;
    }

    enterClassDeclaration(ctx: ClassDeclarationContext): void {
        this.apexType['class'] = true;
    }

    public getApexType(): ApexType {
        return this.apexType;
    }
}

interface ApexType {
    class: boolean;
    testClass: boolean;
    interface: boolean;
}
