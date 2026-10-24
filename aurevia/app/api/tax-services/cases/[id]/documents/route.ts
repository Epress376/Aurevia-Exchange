import {NextResponse} from 'next/server';
import {TaxCaseStatus,TaxDocumentCategory} from '@prisma/client';
import {requireUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {canUserEditCase,userHasTaxAccess} from '@/lib/tax-services';
import {createPrivateObjectKey,hasMatchingFileExtension,PrivateStorageError,uploadPrivateObject} from '@/lib/private-storage';
import {jsonSafe} from '@/lib/serializers';
import {rateLimit} from '@/lib/rate-limit';

type Params={params:Promise<{id:string}>};

const allowed=new Set(['application/pdf','image/jpeg','image/png','image/webp']);

export async function POST(request:Request,{params}:Params){
	try{
		const user=await requireUser();
		const {id}=await params;
		rateLimit(`tax-doc-upload:${user.id}`,30,3600000);
		if(!(await userHasTaxAccess(user.id)))return NextResponse.json({error:'Forbidden'},{status:403});
		const taxCase=await db.taxCase.findFirst({where:{id,userId:user.id}});
		if(!taxCase)return NextResponse.json({error:'Not found'},{status:404});
		if(!canUserEditCase(taxCase.status)&&taxCase.status!==TaxCaseStatus.AWAITING_TAXPAYER_INFO){
			return NextResponse.json({error:'Uploads are not allowed for this case status.'},{status:409});
		}
		const form=await request.formData();
		const file=form.get('file');
		const categoryRaw=String(form.get('category')||'OTHER');
		const description=String(form.get('description')||'').trim().slice(0,300)||null;
		const taxYearRaw=form.get('taxYear');
		const category=Object.values(TaxDocumentCategory).includes(categoryRaw as TaxDocumentCategory)?categoryRaw as TaxDocumentCategory:TaxDocumentCategory.OTHER;
		if(!(file instanceof File))return NextResponse.json({error:'File required.'},{status:400});
		if(!allowed.has(file.type)||!hasMatchingFileExtension(file.name,file.type))return NextResponse.json({error:'Unsupported file type.'},{status:415});
		if(file.size<=0||file.size>12*1024*1024)return NextResponse.json({error:'File size must be between 1 byte and 12 MB.'},{status:400});
		const existing=await db.taxCaseDocument.count({where:{caseId:taxCase.id,deletedAt:null}});
		if(existing>=40)return NextResponse.json({error:'Document limit reached for this case.'},{status:409});
		const key=createPrivateObjectKey('tax',user.id,file.type);
		const buffer=Buffer.from(await file.arrayBuffer());
		await uploadPrivateObject('tax',user.id,key,buffer,file.type);
		const doc=await db.$transaction(async tx=>{
			const created=await tx.taxCaseDocument.create({
				data:{
					caseId:taxCase.id,
					userId:user.id,
					category,
					description,
					taxYear:taxYearRaw?Number(taxYearRaw)||null:taxCase.taxYear,
					filename:file.name.slice(0,180),
					mimeType:file.type,
					size:file.size,
					storageKey:key,
				},
			});
			await tx.auditLog.create({data:{actorId:user.id,action:'TAX_DOCUMENT_UPLOADED',entity:'TAX_CASE',entityId:taxCase.id,metadata:{documentId:created.id,category,size:file.size,mimeType:file.type}}});
			return created;
		});
		return NextResponse.json(jsonSafe(doc),{status:201,headers:{'Cache-Control':'private, no-store'}});
	}catch(error){
		if(error instanceof PrivateStorageError)return NextResponse.json({error:error.message},{status:error.status});
		if(error instanceof Error&&error.message==='RATE_LIMITED')return NextResponse.json({error:'Too many uploads.'},{status:429});
		console.error('tax document upload failed',error instanceof Error?error.name:'UnknownError');
		return NextResponse.json({error:'Unable to upload document.'},{status:500});
	}
}
