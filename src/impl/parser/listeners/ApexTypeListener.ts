import {
  ApexParserListener,
  AnnotationContext,
  InterfaceDeclarationContext,
  ClassDeclarationContext,
} from "apex-parser";

export default class ApexTypeListener implements ApexParserListener {
  private apexType: ApexType = {
    class: false,
    testClass: false,
    interface: false,
  };

  protected enterAnnotation(ctx: AnnotationContext): void {
    if (ctx._stop.text.toUpperCase() === "ISTEST") {
      this.apexType["testClass"] = true;
    }
  }

  private enterInterfaceDeclaration(ctx: InterfaceDeclarationContext): void {
    this.apexType["interface"] = true;
  }

  private enterClassDeclaration(ctx: ClassDeclarationContext): void {
    this.apexType["class"] = true;
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
